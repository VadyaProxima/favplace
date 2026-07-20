import {
	decodeDemTile,
	fetchTile,
	getDemProvider,
	getTilesForBounds,
	getZoomForRadius,
	latToWorldY,
	lngToWorldX,
	type DemProvider,
} from './tiles'

export interface HeightMap {
	data: number[][]
	width: number
	height: number
	minElevation: number
	maxElevation: number
	demSource?: DemProvider
	tileZoom?: number
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

/** side of the intermediate cropped grid, before the caller's resampleHeightMap resize */
const CROP_SIZE = 256

async function fetchHeightMap(
	centerLat: number,
	centerLng: number,
	radiusMeters: number,
): Promise<HeightMap> {
	const provider = getDemProvider()
	const zoom = getZoomForRadius(radiusMeters, centerLat, provider)
	const { latDeg, lngDeg } = metersToDegrees(centerLat, radiusMeters)

	const swLat = centerLat - latDeg
	const swLng = centerLng - lngDeg
	const neLat = centerLat + latDeg
	const neLng = centerLng + lngDeg

	const tiles = getTilesForBounds(swLat, swLng, neLat, neLng, zoom)

	if (tiles.length === 0) {
		throw new Error('No tiles found for the given coordinates')
	}

	const tileData = await Promise.all(
		tiles.map(async tile => {
			const buf = await fetchTile(tile, provider)
			const decoded = decodeDemTile(buf, provider)
			return { tile, ...decoded }
		}),
	)

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
		const lat = neLat - (row / (CROP_SIZE - 1)) * (neLat - swLat)
		const py = (latToWorldY(lat) - worldYmin) * pxPerWorldY * pxScale
		for (let col = 0; col < CROP_SIZE; col++) {
			const lng = swLng + (col / (CROP_SIZE - 1)) * (neLng - swLng)
			const px = (lngToWorldX(lng) - worldXmin) * pxPerWorldX * pxScale
			const val = sampleBilinear(merged, totalW, totalH, px, py)
			cropped[row * CROP_SIZE + col] = val
			if (val < globalMin) globalMin = val
			if (val > globalMax) globalMax = val
		}
	}

	// Robust local contrast — 5th–95th percentile instead of global min/max
	const sorted = Float32Array.from(cropped).filter(Number.isFinite).sort((a, b) => a - b)
	const lo = sorted[Math.floor(sorted.length * 0.05)] ?? globalMin
	const hi = sorted[Math.floor(sorted.length * 0.95)] ?? globalMax
	const range = hi - lo

	const data: number[][] = []
	for (let row = 0; row < CROP_SIZE; row++) {
		const rowData: number[] = []
		for (let col = 0; col < CROP_SIZE; col++) {
			const val = cropped[row * CROP_SIZE + col]
			const normalized =
				range > 1e-6 ? Math.min(1, Math.max(0, (val - lo) / range)) : 0
			rowData.push(normalized)
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

export { fetchHeightMap }

export function resampleHeightMap(
	heightMap: HeightMap,
	targetSize: number,
): HeightMap {
	const { data, width, height, minElevation, maxElevation } = heightMap
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
	}
}
