import { PNG } from "pngjs";

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

export type DemProvider = "mapbox" | "terrarium";

const TERRARIUM_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
// Terrain-DEM v1 отдаёт 404 на z15 и выше: код просил z15, получал отказ и
// молча откатывался на z14, теряя половину линейного разрешения. Terrain-RGB
// работает на z15 (и даже z16), поэтому для мелких участков рельеф вдвое
// подробнее: 1,74 м/пиксель против 3,47 на широте 43°.
const MAPBOX_DEM_TILESET = "mapbox.terrain-rgb";

/** Логический тайл Terrain-RGB — 256 px; @2x возвращает 512 физических. */
export const MAPBOX_DEM_LOGICAL_SIZE = 256;

/** Web Mercator world-fraction X ([0..1], 0 = -180°, 1 = +180°) for a longitude. */
export function lngToWorldX(lng: number): number {
  return (lng + 180) / 360;
}

/** Web Mercator world-fraction Y ([0..1], 0 = north pole, 1 = south pole) for a latitude. */
export function latToWorldY(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
}

export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(lngToWorldX(lng) * n);
  const y = Math.floor(latToWorldY(lat) * n);
  return { x, y };
}

export function tileBounds(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const swLng = (x / n) * 360 - 180;
  const neLng = ((x + 1) / n) * 360 - 180;
  const swLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const neLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return {
    sw: { lat: (swLatRad * 180) / Math.PI, lng: swLng },
    ne: { lat: (neLatRad * 180) / Math.PI, lng: neLng },
  };
}

export function getTilesForBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  zoom: number,
): TileCoord[] {
  const sw = latLngToTile(swLat, swLng, zoom);
  const ne = latLngToTile(neLat, neLng, zoom);
  const tiles: TileCoord[] = [];

  const minX = Math.min(sw.x, ne.x);
  const maxX = Math.max(sw.x, ne.x);
  const minY = Math.min(ne.y, sw.y);
  const maxY = Math.max(ne.y, sw.y);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }
  return tiles;
}

export function getDemProvider(): DemProvider {
	const raw = process.env.MAPBOX_ACCESS_TOKEN?.trim()
	const token = raw?.split(/\s+/)[0]
	return token ? 'mapbox' : 'terrarium'
}

export function getMapboxAccessToken(): string {
	const raw = process.env.MAPBOX_ACCESS_TOKEN?.trim()
	const token = raw?.split(/\s+/)[0]
	if (!token) {
		throw new Error('MAPBOX_ACCESS_TOKEN is not set')
	}
	return token
}

/** Prefer sharper DEM when tile count stays reasonable (wildring-like ridges). */
export function getZoomForRadius(
  radiusMeters: number,
  centerLat: number,
  provider: DemProvider = getDemProvider(),
): number {
  const maxZ = 15;
  const latDeg = (radiusMeters / 111_320) * 2;
  const lngDeg =
    (radiusMeters / (111_320 * Math.cos((centerLat * Math.PI) / 180))) * 2;
  const longestEdgeDeg = Math.max(latDeg, lngDeg);
  // Aim for dense DEM sampling across the crop (~Mapbox @2x)
  const adaptive = Math.floor(Math.log2(3200 / Math.max(longestEdgeDeg, 1e-6)));

  let z: number;
  if (radiusMeters <= 100) z = 15;
  else if (radiusMeters <= 200) z = 15;
  else if (radiusMeters <= 500) z = 15;
  else if (radiusMeters <= 1000) z = 14;
  else if (radiusMeters <= 2000) z = 13;
  else if (radiusMeters <= 5000) z = 12;
  else if (radiusMeters <= 10000) z = 11;
  else if (radiusMeters <= 20000) z = 10;
  else z = 9;

  return Math.min(maxZ, Math.max(1, Math.min(z, adaptive)));
}

/** Cap tile fan-out so large radii don't explode memory / S3 load. */
export const MAX_DEM_TILES = 25;

export function resolveZoomForBounds(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  preferredZoom: number,
  maxTiles = MAX_DEM_TILES,
): number {
  let z = preferredZoom;
  while (z > 1 && getTilesForBounds(swLat, swLng, neLat, neLng, z).length > maxTiles) {
    z -= 1;
  }
  return z;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function fetchTilesLimited(
  tiles: TileCoord[],
  provider: DemProvider = getDemProvider(),
  concurrency = 4,
): Promise<Buffer[]> {
  return mapPool(tiles, concurrency, (tile) => fetchTile(tile, provider));
}

const tileCache = new Map<string, Buffer>();
const TILE_CACHE_MAX = 256;

function cacheKey(provider: DemProvider, tile: TileCoord) {
  return `${provider}/${tile.z}/${tile.x}/${tile.y}`;
}

function mapboxTileUrl(tile: TileCoord, token: string) {
  return `https://api.mapbox.com/v4/${MAPBOX_DEM_TILESET}/${tile.z}/${tile.x}/${tile.y}@2x.pngraw?access_token=${token}`;
}

function terrariumTileUrl(tile: TileCoord) {
  return `${TERRARIUM_BASE}/${tile.z}/${tile.x}/${tile.y}.png`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTile(
  tile: TileCoord,
  provider: DemProvider = getDemProvider(),
): Promise<Buffer> {
  const key = cacheKey(provider, tile);
  const cached = tileCache.get(key);
  if (cached) return cached;

  const url =
    provider === "mapbox"
      ? mapboxTileUrl(tile, getMapboxAccessToken())
      : terrariumTileUrl(tile);

  const maxAttempts = 6;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        headers: { "User-Agent": "favplace-terrain/1.0" },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (tileCache.size >= TILE_CACHE_MAX) {
          const oldest = tileCache.keys().next().value;
          if (oldest) tileCache.delete(oldest);
        }
        tileCache.set(key, buf);
        return buf;
      }
      // Невалидный токен — ретраи бессмысленны
      if (res.status === 401 || res.status === 403) {
        throw new Error(`HTTP ${res.status}`);
      }
      lastErr = new Error(`HTTP ${res.status}`);
      // Rate limit / transient CDN — backoff
      if (res.status === 429 || res.status >= 500) {
        await sleep(400 * Math.pow(2, attempt) + Math.random() * 200);
        continue;
      }
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("HTTP 401") || msg.includes("HTTP 403")) {
        break;
      }
      // Network blips (fetch failed / abort) — retry with backoff
      await sleep(350 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    await sleep(300 * Math.pow(2, attempt));
  }
  throw new Error(`Failed to fetch tile ${key}: ${(lastErr as Error)?.message}`);
}

export function decodeTerrarium(pngBuffer: Buffer): { data: Float32Array; width: number; height: number } {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  const elevations = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    elevations[i] = r * 256 + g + b / 256 - 32768;
  }

  return { data: elevations, width, height };
}

/** Mapbox Terrain-DEM / Terrain-RGB decoding (0.1 m steps). */
export function decodeMapboxDem(pngBuffer: Buffer): {
  data: Float32Array;
  width: number;
  height: number;
  logicalWidth: number;
} {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  const elevations = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    elevations[i] = -10000 + (65536 * r + 256 * g + b) * 0.1;
  }

  const logicalWidth = width >= MAPBOX_DEM_LOGICAL_SIZE * 1.5 ? MAPBOX_DEM_LOGICAL_SIZE : width;
  return { data: elevations, width, height, logicalWidth };
}

export function decodeDemTile(
  pngBuffer: Buffer,
  provider: DemProvider,
): { data: Float32Array; width: number; height: number; logicalWidth: number } {
  if (provider === "mapbox") {
    return decodeMapboxDem(pngBuffer);
  }
  const decoded = decodeTerrarium(pngBuffer);
  return { ...decoded, logicalWidth: decoded.width };
}
