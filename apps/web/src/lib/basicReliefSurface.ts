function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

/** Extra DEM around the user-selected square, used only on the ring shoulders. */
export const TERRAIN_CONTEXT_SCALE = 1.22

/** Total lift requested for the terrain skin, as a fraction of relief amplitude. */
export const RELIEF_SURFACE_LIFT_RATIO = 0.55

export function terrainContextRadius(selectedRadiusMeters: number): number {
	const radius = Math.max(
		1,
		Number.isFinite(selectedRadiusMeters) ? selectedRadiusMeters : 1,
	)
	return Math.round(radius * TERRAIN_CONTEXT_SCALE)
}

/** Keep full terrain across most of the shoulder, blending only at its edge. */
export function shoulderReliefStrength(shoulderProgress: number): number {
	const fade = clamp((shoulderProgress - 0.72) / 0.28, 0, 1)
	const smoothFade = fade * fade * (3 - 2 * fade)
	return 1 - smoothFade
}

/** Keeps the sparse host directly below the lifted terrain until both seat. */
export function hostReliefDisplacement(
	carveOffset: number,
	amplitude: number,
	reliefStrength: number,
	clearance: number,
): number {
	const strength = clamp(reliefStrength, 0, 1)
	return carveOffset * amplitude * strength - clearance
}

/**
 * Jewellery-safe terrain height. The UI slider changes the visible terrain,
 * while the face size keeps the result proportional across ring variants.
 */
export function reliefAmplitudeForTable(
	shortestSide: number,
	reliefHeight: number,
): number {
	const side = Math.max(0, Number.isFinite(shortestSide) ? shortestSide : 0)
	// Верхняя граница поднята с 3: сюда приходит не сырой ползунок, а уже
	// пересчитанный в reliefCalibration вход, и на максимуме он доходит до ~12.
	// Со старым клампом базовые формы упирались в потолок вчетверо ниже эталона.
	const slider = clamp(reliefHeight, 0.4, 16)
	return side * (0.035 + slider * 0.04)
}

export interface ReliefEmbedding {
	amplitude: number
	backingDepth: number
}

/**
 * Keeps the backing below the deepest possible carved valley. The terrain
 * maximum itself stays exactly on the original table datum.
 */
export function reliefEmbeddingForTable(
	shortestSide: number,
	reliefHeight: number,
	reliefScale: number,
): ReliefEmbedding {
	const scale = Math.min(
		1,
		Math.max(0.15, Number.isFinite(reliefScale) ? reliefScale : 1),
	)
	const amplitude = reliefAmplitudeForTable(shortestSide, reliefHeight) * scale
	return {
		amplitude,
		backingDepth: amplitude * 1.12,
	}
}

/**
 * Restores part of the physical scale lost when the API normalizes every DEM
 * to 0–1. Mountainous crops keep full relief; low-relief crops retain a small
 * readable exaggeration without becoming artificial mountain ranges.
 */
export function terrainRangeScale(
	elevationRangeMeters: number | null | undefined,
	radiusMeters: number,
): number {
	if (!Number.isFinite(elevationRangeMeters)) return 1
	if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return 1
	return clamp(Number(elevationRangeMeters) / (radiusMeters * 0.08), 0.15, 1)
}

export type BasicReliefShape = 'square' | 'circle' | 'oval'

export interface CushionReliefFrame {
	cx: number
	cz: number
	rx: number
	rz: number
	/** Physical half-extents of the exact user-selected footprint. */
	innerRx?: number
	innerRz?: number
	baseY: number
	amplitude: number
	/** Constant vertical offset applied after host seating and terrain carving. */
	surfaceLift?: number
	/** Carved keeps peaks at zero; raised keeps valleys at zero. */
	heightMode?: 'carved' | 'raised'
	/** Normalized footprint radius where a smooth return to the datum begins. */
	boundarySeatStart?: number
	shape: BasicReliefShape
	radialSegments?: number
	angularSegments?: number
	cornerRadius?: number
	outerCornerRadius?: number
	/** Fraction occupied by the exact square selected by the user. */
	innerFootprintRatio?: number
	/** Downward continuation from the flat table onto the outer shoulder. */
	edgeDrop?: number
	/** Blend only the added context back into the host at the outer edge. */
	fadeReliefOnShoulder?: boolean
	/** Exact original host height under an extended terrain vertex. */
	baseHeightAt?: (x: number, z: number) => number
	/** Reject ray hits below the upper shoulder (for example the lower shank). */
	minimumBaseY?: number
	/**
	 * Абсолютный Y замыкающего дна под шкуркой рельефа.
	 *
	 * Если задан, поверхность выходит замкнутым телом: стенка по периметру
	 * вниз до этой плоскости плюс плоское дно. Периметр шкурки уже посажен
	 * на площадку кольца, поэтому стенка целиком уходит внутрь корпуса —
	 * снаружи ничего нового не появляется, но у меша появляется объём и
	 * пропадают 1024 граничных ребра, из-за которых литейщик файл не примет.
	 *
	 * Это не воскрешение снятых `perimeterSkirtDepth` / `perimeterSkirtInset`:
	 * та стенка росла наружу и была видна, эта уходит вниз под поверхность.
	 */
	backingY?: number
}

export interface CushionReliefSurfaceData {
	positions: Float32Array
	indices: Uint32Array
	topVertexCount: number
	sourceMinimum: number
	sourceMaximum: number
	minCarveOffset: number
	maxCarveOffset: number
	/** Замкнуто ли тело стенкой и дном (см. `backingY`). */
	closed: boolean
}

/**
 * Индексы вершин по контуру сетки, в том же направлении, в каком это ребро
 * обходит верхний треугольник. Порядок важен: стенка обходит каждое ребро в
 * обратную сторону, и только тогда меш получается согласованно ориентированным.
 */
function boundaryLoop(
	xSegments: number,
	zSegments: number,
	rowSize: number,
): number[] {
	const at = (row: number, column: number) => row * rowSize + column
	const loop: number[] = []
	for (let column = xSegments; column > 0; column--) loop.push(at(0, column))
	for (let row = 0; row < zSegments; row++) loop.push(at(row, 0))
	for (let column = 0; column < xSegments; column++) loop.push(at(zSegments, column))
	for (let row = zSegments; row > 0; row--) loop.push(at(row, xSegments))
	return loop
}

function sampleHeightMap(heightMap: number[][], u: number, v: number): number {
	const rows = heightMap.length
	const cols = rows > 0 ? heightMap[0]?.length ?? 0 : 0
	if (rows === 0 || cols === 0) return 0

	const x = clamp(u, 0, 1) * (cols - 1)
	const y = clamp(v, 0, 1) * (rows - 1)
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const x1 = Math.min(cols - 1, x0 + 1)
	const y1 = Math.min(rows - 1, y0 + 1)
	const tx = x - x0
	const ty = y - y0
	const value = (row: number, col: number) =>
		clamp(Number(heightMap[row]?.[col] ?? 0), 0, 1)
	const a = value(y0, x0) * (1 - tx) + value(y0, x1) * tx
	const b = value(y1, x0) * (1 - tx) + value(y1, x1) * tx
	return a * (1 - ty) + b * ty
}

type CarvedTerrainProfile = {
	minimum: number
	maximum: number
	range: number
}

function carvedTerrainProfile(heightMap: number[][]): CarvedTerrainProfile {
	let minimum = Infinity
	let maximum = -Infinity
	for (const row of heightMap) {
		for (const raw of row) {
			if (!Number.isFinite(raw)) continue
			const value = clamp(Number(raw), 0, 1)
			minimum = Math.min(minimum, value)
			maximum = Math.max(maximum, value)
		}
	}
	if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
		return { minimum: 0, maximum: 0, range: 0 }
	}
	return { minimum, maximum, range: maximum - minimum }
}

function sculptCarveOffset(
	value: number,
	profile: CarvedTerrainProfile,
): number {
	if (profile.range <= 1e-9) return 0
	const depth = clamp(
		(profile.maximum - clamp(value, 0, 1)) / profile.range,
		0,
		1,
	)
	if (depth <= 1e-12) return 0
	return -Math.pow(depth, 0.82)
}

function sculptRaisedOffset(
	value: number,
	profile: CarvedTerrainProfile,
): number {
	if (profile.range <= 1e-9) return 0
	const height = clamp(
		(clamp(value, 0, 1) - profile.minimum) / profile.range,
		0,
		1,
	)
	if (height <= 1e-12) return 0
	return Math.pow(height, 0.82)
}

/** Reusable sampler for seating the coarse host mesh below the dense skin. */
export function createCarvedReliefSampler(heightMap: number[][]) {
	const profile = carvedTerrainProfile(heightMap)
	return (u: number, v: number) =>
		sculptCarveOffset(sampleHeightMap(heightMap, u, v), profile)
}

function outlinePoint(
	angle: number,
	shape: BasicReliefShape,
	cornerRadius: number,
): [number, number] {
	const x = Math.cos(angle)
	const z = Math.sin(angle)
	if (shape !== 'square') return [x, z]

	const scale = 1 / Math.max(Math.abs(x), Math.abs(z), 1e-9)
	let nx = x * scale
	let nz = z * scale
	const corner = clamp(cornerRadius, 0.05, 0.48)
	const inner = 1 - corner
	if (Math.abs(nx) > inner && Math.abs(nz) > inner) {
		const ox = Math.sign(nx) * inner
		const oz = Math.sign(nz) * inner
		const cornerAngle = Math.atan2(nz - oz, nx - ox)
		nx = ox + Math.cos(cornerAngle) * corner
		nz = oz + Math.sin(cornerAngle) * corner
	}
	return [nx, nz]
}

/**
 * Maps a regular square grid to the selected table outline.  Keeping the grid
 * topology regular is important: a polar fan concentrates hundreds of long
 * triangles in one center vertex and invents radial creases in otherwise
 * smooth DEM data.
 */
function tablePoint(
	sx: number,
	sz: number,
	shape: BasicReliefShape,
	cornerRadius: number,
): [number, number] {
	if (shape !== 'square') {
		// Fernandez-Guasti square-to-disc map: every outer grid edge lands on
		// the circular/oval boundary without a singular center pole.
		return [
			sx * Math.sqrt(Math.max(0, 1 - (sz * sz) / 2)),
			sz * Math.sqrt(Math.max(0, 1 - (sx * sx) / 2)),
		]
	}

	const radius = Math.max(Math.abs(sx), Math.abs(sz))
	if (radius <= 1e-12) return [0, 0]
	const [outlineX, outlineZ] = outlinePoint(
		Math.atan2(sz, sx),
		shape,
		cornerRadius,
	)
	return [outlineX * radius, outlineZ * radius]
}

/** Top-only carved terrain skin; its tiny overlap hides the GLB table seam. */
export function buildCushionReliefSurfaceData(
	heightMap: number[][],
	frame: CushionReliefFrame,
): CushionReliefSurfaceData {
	const xSegments = Math.max(2, Math.floor(frame.radialSegments ?? 144))
	const zSegments = Math.max(2, Math.floor(frame.angularSegments ?? 256))
	const rx = Math.max(1e-6, Math.abs(frame.rx))
	const rz = Math.max(1e-6, Math.abs(frame.rz))
	const cx = Number.isFinite(frame.cx) ? frame.cx : 0
	const cz = Number.isFinite(frame.cz) ? frame.cz : 0
	const baseY = Number.isFinite(frame.baseY) ? frame.baseY : 0
	const amplitude = Math.max(
		0,
		Number.isFinite(frame.amplitude) ? frame.amplitude : 0,
	)
	const surfaceLift = Number.isFinite(frame.surfaceLift)
		? Number(frame.surfaceLift)
		: 0
	const heightMode = frame.heightMode ?? 'carved'
	const boundarySeatStart = clamp(frame.boundarySeatStart ?? 1, 0, 1)
	const cornerRadius = frame.cornerRadius ?? 0.35
	const outerCornerRadius = frame.outerCornerRadius ?? cornerRadius
	const innerFootprintRatio = clamp(frame.innerFootprintRatio ?? 1, 0.1, 1)
	const innerRx = Math.min(
		rx,
		Math.max(
			1e-6,
			Number.isFinite(frame.innerRx)
				? Math.abs(Number(frame.innerRx))
				: rx * innerFootprintRatio,
		),
	)
	const innerRz = Math.min(
		rz,
		Math.max(
			1e-6,
			Number.isFinite(frame.innerRz)
				? Math.abs(Number(frame.innerRz))
				: rz * innerFootprintRatio,
		),
	)
	const edgeDrop = Math.max(
		0,
		Number.isFinite(frame.edgeDrop) ? Number(frame.edgeDrop) : 0,
	)
	const fadeReliefOnShoulder = frame.fadeReliefOnShoulder ?? false
	const minimumBaseY = Number.isFinite(frame.minimumBaseY)
		? Number(frame.minimumBaseY)
		: -Infinity
	const profile = carvedTerrainProfile(heightMap)
	const sampleReliefOffset = (u: number, v: number) => {
		const value = sampleHeightMap(heightMap, u, v)
		return heightMode === 'raised'
			? sculptRaisedOffset(value, profile)
			: sculptCarveOffset(value, profile)
	}
	const rowSize = xSegments + 1
	const topVertexCount = rowSize * (zSegments + 1)
	const requestedBackingY = Number.isFinite(frame.backingY)
		? Number(frame.backingY)
		: null
	const loop = requestedBackingY === null ? null : boundaryLoop(xSegments, zSegments, rowSize)
	// Стенка дублирует вершины контура, чтобы усреднение нормалей не заваливало
	// крайний ряд верхней сетки: видимая часть остаётся ровно такой же, как без
	// замыкания. Аудит склеивает вершины по координатам, дубли ему не мешают.
	const closingVertexCount = loop === null ? 0 : loop.length * 2 + 1
	const positions = new Float32Array((topVertexCount + closingVertexCount) * 3)
	let minCarveOffset = Infinity
	let maxCarveOffset = -Infinity
	let minTopY = Infinity

	let vertex = 0
	for (let row = 0; row <= zSegments; row++) {
		const sz = (row / zSegments) * 2 - 1
		for (let column = 0; column <= xSegments; column++) {
			const sx = (column / xSegments) * 2 - 1
			const footprintMetric = Math.max(Math.abs(sx), Math.abs(sz))
			const unitGridX =
				footprintMetric <= 1e-12 ? 0 : sx / footprintMetric
			const unitGridZ =
				footprintMetric <= 1e-12 ? 0 : sz / footprintMetric
			const [innerOutlineX, innerOutlineZ] =
				footprintMetric <= 1e-12
					? [0, 0]
					: tablePoint(
							unitGridX,
							unitGridZ,
							frame.shape,
							cornerRadius,
						)
			const [outerOutlineX, outerOutlineZ] =
				footprintMetric <= 1e-12
					? [0, 0]
					: tablePoint(
							unitGridX,
							unitGridZ,
							frame.shape,
							outerCornerRadius,
						)
			let physicalX: number
			let physicalZ: number
			let shoulderLinear = 0
			if (footprintMetric <= innerFootprintRatio) {
				const innerRadius = footprintMetric / innerFootprintRatio
				physicalX = innerOutlineX * innerRx * innerRadius
				physicalZ = innerOutlineZ * innerRz * innerRadius
			} else {
				shoulderLinear = clamp(
					(footprintMetric - innerFootprintRatio) /
						Math.max(1e-9, 1 - innerFootprintRatio),
					0,
					1,
				)
				physicalX =
					innerOutlineX * innerRx * (1 - shoulderLinear) +
					outerOutlineX * rx * shoulderLinear
				physicalZ =
					innerOutlineZ * innerRz * (1 - shoulderLinear) +
					outerOutlineZ * rz * shoulderLinear
			}
			const reliefOffset = sampleReliefOffset(
				(sx + 1) * 0.5,
				1 - (sz + 1) * 0.5,
			)
			const shoulderBlend =
				shoulderLinear * shoulderLinear * (3 - 2 * shoulderLinear)
			const fallbackBaseY = baseY - edgeDrop * shoulderBlend
			const sampledBaseY = frame.baseHeightAt?.(
				cx + physicalX,
				cz + physicalZ,
			)
			const localBaseY =
				Number.isFinite(sampledBaseY) && Number(sampledBaseY) >= minimumBaseY
				? Number(sampledBaseY)
				: fallbackBaseY
			const shoulderStrength = fadeReliefOnShoulder
				? shoulderReliefStrength(shoulderLinear)
				: 1
			const boundaryStrength =
				boundarySeatStart < 1
					? (() => {
							const t = clamp(
								(1 - footprintMetric) /
									Math.max(1e-9, 1 - boundarySeatStart),
								0,
								1,
							)
							return t * t * (3 - 2 * t)
						})()
					: 1
			const reliefStrength = shoulderStrength * boundaryStrength
			const offset = vertex * 3
			const y =
				localBaseY +
				surfaceLift * reliefStrength +
				reliefOffset * amplitude * reliefStrength
			positions[offset] = cx + physicalX
			positions[offset + 1] = y
			positions[offset + 2] = cz + physicalZ
			minCarveOffset = Math.min(minCarveOffset, reliefOffset)
			maxCarveOffset = Math.max(maxCarveOffset, reliefOffset)
			minTopY = Math.min(minTopY, y)
			vertex++
		}
	}

	const perimeter = loop?.length ?? 0
	// Каждое ребро контура даёт два треугольника стенки, плюс веер дна.
	const triangleCount = xSegments * zSegments * 2 + perimeter * 3
	const indices = new Uint32Array(triangleCount * 3)
	let cursor = 0
	for (let row = 0; row < zSegments; row++) {
		for (let column = 0; column < xSegments; column++) {
			const a = row * rowSize + column
			const b = a + 1
			const c = a + rowSize
			const d = c + 1
			indices[cursor++] = a
			indices[cursor++] = c
			indices[cursor++] = b
			indices[cursor++] = b
			indices[cursor++] = c
			indices[cursor++] = d
		}
	}

	if (loop !== null && requestedBackingY !== null) {
		// Дно обязано лежать ниже всей шкурки, иначе тело вывернется наизнанку.
		const span = Math.max(1e-6, Math.abs(rx) + Math.abs(rz))
		const floorY = Math.min(requestedBackingY, minTopY - span * 1e-4)
		const wallTop = topVertexCount
		const wallBottom = wallTop + perimeter
		const center = wallBottom + perimeter

		for (let i = 0; i < perimeter; i++) {
			const source = loop[i] * 3
			const top = (wallTop + i) * 3
			const bottom = (wallBottom + i) * 3
			positions[top] = positions[source]
			positions[top + 1] = positions[source + 1]
			positions[top + 2] = positions[source + 2]
			positions[bottom] = positions[source]
			positions[bottom + 1] = floorY
			positions[bottom + 2] = positions[source + 2]
		}
		positions[center * 3] = cx
		positions[center * 3 + 1] = floorY
		positions[center * 3 + 2] = cz

		for (let i = 0; i < perimeter; i++) {
			const next = (i + 1) % perimeter
			const p = wallTop + i
			const q = wallTop + next
			const pb = wallBottom + i
			const qb = wallBottom + next
			// Верхний треугольник проходит ребро p→q, стенка обходит его q→p.
			indices[cursor++] = q
			indices[cursor++] = p
			indices[cursor++] = pb
			indices[cursor++] = q
			indices[cursor++] = pb
			indices[cursor++] = qb
			// Дно замыкает стенку ребром qb→pb, нормалью вниз.
			indices[cursor++] = qb
			indices[cursor++] = pb
			indices[cursor++] = center
		}
	}

	return {
		positions,
		indices,
		topVertexCount,
		sourceMinimum: profile.minimum,
		sourceMaximum: profile.maximum,
		minCarveOffset: Number.isFinite(minCarveOffset) ? minCarveOffset : 0,
		maxCarveOffset: Number.isFinite(maxCarveOffset) ? maxCarveOffset : 0,
		closed: loop !== null,
	}
}
