import {
	decodeTerrarium,
	fetchTile,
	getTilesForBounds,
	getZoomForRadius,
	tileBounds,
} from './tiles'

export interface HeightMap {
	data: number[][]
	width: number
	height: number
	minElevation: number
	maxElevation: number
}

export function computeRadiusInDegrees(
	lat: number,
	radiusMeters: number,
): number {
	const latDeg = radiusMeters / 111_320
	const lngDeg = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180))
	return Math.max(latDeg, lngDeg)
}

export async function fetchHeightMap(
	centerLat: number,
	centerLng: number,
	radiusMeters: number,
): Promise<HeightMap> {
	const zoom = getZoomForRadius(radiusMeters)
	const deg = computeRadiusInDegrees(centerLat, radiusMeters)

	const swLat = centerLat - deg
	const swLng = centerLng - deg
	const neLat = centerLat + deg
	const neLng = centerLng + deg

	const tiles = getTilesForBounds(swLat, swLng, neLat, neLng, zoom)

	if (tiles.length === 0) {
		throw new Error('No tiles found for the given coordinates')
	}

	const tileData = await Promise.all(
		tiles.map(async tile => {
			const buf = await fetchTile(tile)
			const decoded = decodeTerrarium(buf)
			const bounds = tileBounds(tile.x, tile.y, tile.z)
			return { tile, ...decoded, bounds }
		}),
	)

	const cols = new Set(tileData.map(t => t.tile.x))
	const rows = new Set(tileData.map(t => t.tile.y))
	const numCols = cols.size
	const numRows = rows.size

	const tileW = tileData[0].width
	const tileH = tileData[0].height
	const totalW = numCols * tileW
	const totalH = numRows * tileH

	const minCol = Math.min(...[...cols])
	const minRow = Math.min(...[...rows])

	const merged = new Float32Array(totalW * totalH)

	for (const td of tileData) {
		const offsetX = (td.tile.x - minCol) * tileW
		const offsetY = (td.tile.y - minRow) * tileH
		for (let row = 0; row < td.height; row++) {
			for (let col = 0; col < td.width; col++) {
				const srcIdx = row * td.width + col
				const dstIdx = (offsetY + row) * totalW + (offsetX + col)
				merged[dstIdx] = td.data[srcIdx]
			}
		}
	}

	let globalMin = Infinity
	let globalMax = -Infinity
	for (let i = 0; i < merged.length; i++) {
		if (merged[i] < globalMin) globalMin = merged[i]
		if (merged[i] > globalMax) globalMax = merged[i]
	}

	const data: number[][] = []
	for (let row = 0; row < totalH; row++) {
		const rowData: number[] = []
		for (let col = 0; col < totalW; col++) {
			const val = merged[row * totalW + col]
			const normalized =
				globalMax > globalMin ? (val - globalMin) / (globalMax - globalMin) : 0
			rowData.push(normalized)
		}
		data.push(rowData)
	}

	return {
		data,
		width: totalW,
		height: totalH,
		minElevation: globalMin,
		maxElevation: globalMax,
	}
}

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
