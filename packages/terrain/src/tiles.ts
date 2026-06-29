import { PNG } from "pngjs";

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

const TERRARIUM_BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
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

export function getZoomForRadius(radiusMeters: number): number {
  if (radiusMeters <= 200) return 14;
  if (radiusMeters <= 500) return 13;
  if (radiusMeters <= 1000) return 12;
  if (radiusMeters <= 2000) return 11;
  if (radiusMeters <= 5000) return 10;
  if (radiusMeters <= 10000) return 9;
  return 8;
}

export async function fetchTile(tile: TileCoord): Promise<Buffer> {
  const url = `${TERRARIUM_BASE}/${tile.z}/${tile.x}/${tile.y}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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
