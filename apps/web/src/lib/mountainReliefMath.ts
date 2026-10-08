function clamp01(value: number): number {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function smootherstep01(value: number): number {
	const t = clamp01(value)
	return t * t * t * (t * (t * 6 - 15) + 10)
}

function sampleHeightMap(heightMap: number[][], u: number, v: number): number {
	const rows = heightMap.length
	const cols = rows > 0 ? heightMap[0]?.length ?? 0 : 0
	if (rows === 0 || cols === 0) return 0

	const x = clamp01(u) * (cols - 1)
	const y = clamp01(v) * (rows - 1)
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const x1 = Math.min(cols - 1, x0 + 1)
	const y1 = Math.min(rows - 1, y0 + 1)
	const tx = x - x0
	const ty = y - y0

	const value = (row: number, col: number) => {
		const sample = heightMap[row]?.[col]
		return Number.isFinite(sample) ? Number(sample) : 0
	}
	const a = value(y0, x0) * (1 - tx) + value(y0, x1) * tx
	const b = value(y1, x0) * (1 - tx) + value(y1, x1) * tx
	return a * (1 - ty) + b * ty
}

/**
 * Full relief in the socket interior and an exact zero-height boundary.
 * `u` and `v` are normalized to [-1, 1].
 */
export function reliefEdgeMask(
	u: number,
	v: number,
	fade: number,
	power = 4,
): number {
	const safePower = Math.max(1, Number.isFinite(power) ? power : 4)
	const safeFade = Math.min(1, Math.max(1e-6, Number.isFinite(fade) ? fade : 0.18))
	const radius =
		(Math.abs(u) ** safePower + Math.abs(v) ** safePower) **
		(1 / safePower)
	const innerRadius = 1 - safeFade
	if (radius <= innerRadius) return 1
	if (radius >= 1) return 0
	return 1 - smootherstep01((radius - innerRadius) / safeFade)
}

export function buildMaskedHeightField(
	heightMap: number[][],
	rows: number,
	cols: number,
	fade: number,
	power = 4,
): Float32Array {
	const safeRows = Math.max(2, Math.floor(rows))
	const safeCols = Math.max(2, Math.floor(cols))
	const field = new Float32Array(safeRows * safeCols)

	for (let row = 0; row < safeRows; row++) {
		const v01 = row / (safeRows - 1)
		const v = v01 * 2 - 1
		for (let col = 0; col < safeCols; col++) {
			const u01 = col / (safeCols - 1)
			const u = u01 * 2 - 1
			const onGridBorder =
				row === 0 || row === safeRows - 1 || col === 0 || col === safeCols - 1
			const mask = onGridBorder ? 0 : reliefEdgeMask(u, v, fade, power)
			field[row * safeCols + col] = sampleHeightMap(heightMap, u01, v01) * mask
		}
	}

	return field
}

export interface ReliefSurfaceFrame {
	length: number
	width: number
	baseY: number
	amplitude: number
	rows: number
	cols: number
	edgeFade: number
	power?: number
}

export interface ReliefSurfaceData {
	positions: Float32Array
	indices: Uint32Array
}

export function buildReliefSurfaceData(
	heightMap: number[][],
	frame: ReliefSurfaceFrame,
): ReliefSurfaceData {
	const rows = Math.max(2, Math.floor(frame.rows))
	const cols = Math.max(2, Math.floor(frame.cols))
	const length = Math.max(1e-6, Math.abs(frame.length))
	const width = Math.max(1e-6, Math.abs(frame.width))
	const baseY = Number.isFinite(frame.baseY) ? frame.baseY : 0
	const amplitude = Math.max(0, Number.isFinite(frame.amplitude) ? frame.amplitude : 0)
	const field = buildMaskedHeightField(
		heightMap,
		rows,
		cols,
		frame.edgeFade,
		frame.power,
	)
	const positions = new Float32Array(rows * cols * 3)
	const indices = new Uint32Array((rows - 1) * (cols - 1) * 6)

	for (let row = 0; row < rows; row++) {
		const v = row / (rows - 1)
		for (let col = 0; col < cols; col++) {
			const u = col / (cols - 1)
			const vertex = row * cols + col
			const offset = vertex * 3
			positions[offset] = (u - 0.5) * length
			positions[offset + 1] = baseY + field[vertex] * amplitude
			positions[offset + 2] = (v - 0.5) * width
		}
	}

	let cursor = 0
	for (let row = 0; row < rows - 1; row++) {
		for (let col = 0; col < cols - 1; col++) {
			const a = row * cols + col
			const b = a + 1
			const c = (row + 1) * cols + col
			const d = c + 1
			indices[cursor++] = a
			indices[cursor++] = c
			indices[cursor++] = b
			indices[cursor++] = b
			indices[cursor++] = c
			indices[cursor++] = d
		}
	}

	return { positions, indices }
}
