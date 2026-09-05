import {
	decodeDemTile,
	fetchTilesLimited,
	getDemProvider,
	getTilesForBounds,
	getZoomForRadius,
	latToWorldY,
	lngToWorldX,
	resolveZoomForBounds,
	type DemProvider,
} from './tiles'
import {
	clampZoomOffset,
	cropEnvelopeScale,
	rotatedCropCoordinate,
} from './referenceFrame'

export interface HeightMap {
	data: number[][]
	width: number
	height: number
	minElevation: number
	maxElevation: number
	demSource?: DemProvider
	tileZoom?: number
}

export interface HeightMapRequestOptions {
	bearing?: number
	zoomOffset?: number
}

/** meters-per-degree latitude is constant; longitude shrinks by cos(lat). */
function metersToDegrees(lat: number, radiusMeters: number) {
	const latDeg = radiusMeters / 111_320
	const lngDeg = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180))
	return { latDeg, lngDeg }
}

/** kept for API compatibility — the max of the two axis deltas (square in the wider direction). */
export function computeRadiusInDegrees(lat: number, radiusMeters: number): number {
	const { latDeg, lngDeg } = metersToDegrees(lat, radiusMeters)
	return Math.max(latDeg, lngDeg)
}

function sampleBilinear(data: Float32Array, w: number, h: number, px: number, py: number) {
	const x0 = Math.floor(px)
	const y0 = Math.floor(py)
	const x1 = x0 + 1
	const y1 = y0 + 1
	const cx0 = Math.min(Math.max(x0, 0), w - 1)
	const cy0 = Math.min(Math.max(y0, 0), h - 1)
	const cx1 = Math.min(Math.max(x1, 0), w - 1)
	const cy1 = Math.min(Math.max(y1, 0), h - 1)
	const fx = px - x0
	const fy = py - y0
	const v00 = data[cy0 * w + cx0]
	const v10 = data[cy0 * w + cx1]
	const v01 = data[cy1 * w + cx0]
	const v11 = data[cy1 * w + cx1]
	return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
}

/** Intermediate crop before client resample — higher = sharper ridges on the ring. */
const CROP_SIZE = 1024

const heightMapMemo = new Map<string, HeightMap>()
const HEIGHTMAP_MEMO_MAX = 24
const inflight = new Map<string, Promise<HeightMap>>()

function memoKey(
	lat: number,
	lng: number,
	radiusMeters: number,
	options: HeightMapRequestOptions,
) {
	// v3 = Terrarium z15 for small crops; avoids reusing the coarser z14 memo.
	return `v4:${lat.toFixed(5)},${lng.toFixed(5)},${Math.round(radiusMeters)},${(
		options.bearing ?? 0
	).toFixed(2)},${clampZoomOffset(options.zoomOffset ?? 0)}`
}

async function fetchHeightMapUncached(
	centerLat: number,
	centerLng: number,
	radiusMeters: number,
	options: HeightMapRequestOptions,
): Promise<HeightMap> {
	const provider = getDemProvider()
	const bearing = options.bearing ?? 0
	const preferredZoom = Math.min(
		15,
		Math.max(
			1,
			getZoomForRadius(radiusMeters, centerLat, provider) +
				clampZoomOffset(options.zoomOffset ?? 0),
		),
	)
	const envelopeRadius = radiusMeters * cropEnvelopeScale(bearing)
	const { latDeg, lngDeg } = metersToDegrees(centerLat, envelopeRadius)

	const swLat = centerLat - latDeg
	const swLng = centerLng - lngDeg
	const neLat = centerLat + latDeg
	const neLng = centerLng + lngDeg

	let zoom = resolveZoomForBounds(swLat, swLng, neLat, neLng, preferredZoom)
	let tiles = getTilesForBounds(swLat, swLng, neLat, neLng, zoom)
	if (tiles.length === 0) {
		throw new Error('No tiles found for the given coordinates')
	}

	// Some Mapbox DEM tiles 404 at z15 — step down until tiles load
	let buffers: Buffer[] | null = null
	let lastErr: unknown
	for (let attempt = 0; attempt < 4; attempt++) {
		tiles = getTilesForBounds(swLat, swLng, neLat, neLng, zoom)
		if (tiles.length === 0) break
		try {
			buffers = await fetchTilesLimited(tiles, provider, 4)
			break
		} catch (err) {
			lastErr = err
			const msg = err instanceof Error ? err.message : String(err)
			if (zoom > 1 && /HTTP 404|Failed to fetch tile/.test(msg)) {
				zoom -= 1
				continue
			}
			throw err
		}
	}
	if (!buffers) {
		throw lastErr instanceof Error
			? lastErr
			: new Error('Failed to fetch DEM tiles')
	}

	const tileData = buffers.map((buf, i) => {
		const decoded = decodeDemTile(buf, provider)
		return { tile: tiles[i], ...decoded }
	})

	const cols = new Set(tileData.map(t => t.tile.x))
	const rows = new Set(tileData.map(t => t.tile.y))
	const numCols = cols.size
	const numRows = rows.size

	const physicalW = tileData[0].width
	const physicalH = tileData[0].height
	const logicalW = tileData[0].logicalWidth
	const logicalH = tileData[0].logicalWidth
	const totalW = numCols * physicalW
	const totalH = numRows * physicalH
	const pxScale = physicalW / logicalW

	const minCol = Math.min(...[...cols])
	const minRow = Math.min(...[...rows])

	const merged = new Float32Array(totalW * totalH)

	for (const td of tileData) {
		const offsetX = (td.tile.x - minCol) * physicalW
		const offsetY = (td.tile.y - minRow) * physicalH
		for (let row = 0; row < td.height; row++) {
			for (let col = 0; col < td.width; col++) {
				const srcIdx = row * td.width + col
				const dstIdx = (offsetY + row) * totalW + (offsetX + col)
				merged[dstIdx] = td.data[srcIdx]
			}
		}
	}

	const n = Math.pow(2, zoom)
	const pxPerWorldX = logicalW * n
	const pxPerWorldY = logicalH * n
	const worldXmin = minCol / n
	const worldYmin = minRow / n

	const cropped = new Float32Array(CROP_SIZE * CROP_SIZE)
	let globalMin = Infinity
	let globalMax = -Infinity

	for (let row = 0; row < CROP_SIZE; row++) {
		for (let col = 0; col < CROP_SIZE; col++) {
			const x = (col / (CROP_SIZE - 1)) * 2 - 1
			const y = (row / (CROP_SIZE - 1)) * 2 - 1
			const { lat, lng } = rotatedCropCoordinate(
				centerLat,
				centerLng,
				radiusMeters,
				bearing,
				x,
				y,
			)
			const py = (latToWorldY(lat) - worldYmin) * pxPerWorldY * pxScale
			const px = (lngToWorldX(lng) - worldXmin) * pxPerWorldX * pxScale
			const val = sampleBilinear(merged, totalW, totalH, px, py)
			cropped[row * CROP_SIZE + col] = val
			if (val < globalMin) globalMin = val
			if (val > globalMax) globalMax = val
		}
	}

	// Linear min–max — preserve craters and real proportions (no percentile / unsharp)
	const range = globalMax - globalMin
	const data: number[][] = []
	for (let row = 0; row < CROP_SIZE; row++) {
		const rowData: number[] = []
		for (let col = 0; col < CROP_SIZE; col++) {
			const val = cropped[row * CROP_SIZE + col]
			rowData.push(range > 1e-6 ? (val - globalMin) / range : 0)
		}
		data.push(rowData)
	}

	return {
		data,
		width: CROP_SIZE,
		height: CROP_SIZE,
		minElevation: globalMin,
		maxElevation: globalMax,
		demSource: provider,
		tileZoom: zoom,
	}
}

async function fetchHeightMap(
	centerLat: number,
	centerLng: number,
	radiusMeters: number,
	options: HeightMapRequestOptions = {},
): Promise<HeightMap> {
	const key = memoKey(centerLat, centerLng, radiusMeters, options)
	const hit = heightMapMemo.get(key)
	if (hit) return hit

	const pending = inflight.get(key)
	if (pending) return pending

	const promise = fetchHeightMapUncached(centerLat, centerLng, radiusMeters, options)
		.then(hm => {
			if (heightMapMemo.size >= HEIGHTMAP_MEMO_MAX) {
				const oldest = heightMapMemo.keys().next().value
				if (oldest) heightMapMemo.delete(oldest)
			}
			heightMapMemo.set(key, hm)
			return hm
		})
		.finally(() => {
			inflight.delete(key)
		})

	inflight.set(key, promise)
	return promise
}

export { fetchHeightMap }

export function resampleHeightMap(
	heightMap: HeightMap,
	targetSize: number,
): HeightMap {
	const { data, width, height, minElevation, maxElevation, demSource, tileZoom } =
		heightMap

	if (targetSize === width && targetSize === height) {
		return heightMap
	}

	const resampled: number[][] = []

	for (let y = 0; y < targetSize; y++) {
		const row: number[] = []
		for (let x = 0; x < targetSize; x++) {
			const srcX = (x / (targetSize - 1)) * (width - 1)
			const srcY = (y / (targetSize - 1)) * (height - 1)

			const x0 = Math.floor(srcX)
			const y0 = Math.floor(srcY)
			const x1 = Math.min(x0 + 1, width - 1)
			const y1 = Math.min(y0 + 1, height - 1)
			const fx = srcX - x0
			const fy = srcY - y0

			const val =
				data[y0][x0] * (1 - fx) * (1 - fy) +
				data[y0][x1] * fx * (1 - fy) +
				data[y1][x0] * (1 - fx) * fy +
				data[y1][x1] * fx * fy

			row.push(val)
		}
		resampled.push(row)
	}

	return {
		data: resampled,
		width: targetSize,
		height: targetSize,
		minElevation,
		maxElevation,
		demSource,
		tileZoom,
	}
}
