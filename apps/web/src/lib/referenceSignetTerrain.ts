/**
 * Диапазон высоты рельефа — реальный диапазон классического сигнета, он же
 * эталон для остальных форм (замер: scripts/qa-relief-height-parity.mjs).
 *
 * Раньше здесь стояло 0,3–3,0 — число из головы, к которому фактическая
 * высота металла не имела отношения ни у одной формы. Теперь значение
 * ползунка равно миллиметрам, на которые реально поднимается рельеф;
 * приведением занимается reliefCalibration.ts.
 */
export const MIN_RELIEF_MM = 0.54
export const MAX_RELIEF_MM = 4.13
export const TERRAIN_CONTEXT_SCALE = 8
export const TERRAIN_EDGE_FADE = 0.02

export interface TerrainGeoFrame {
	lat: number
	lng: number
	radiusKm: number
	bearing: number
}

export interface TerrainFrame {
	data: number[][]
	size: number
	minElev: number
	maxElev: number
	frame: TerrainGeoFrame
	final: boolean
	incomplete?: boolean
}

export interface TerrainFrameTransform {
	scaleX: number
	scaleY: number
	offsetX: number
	offsetY: number
	rotation: number
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

export function clamp01(value: number) {
	return clamp(value, 0, 1)
}

export function reliefMillimeters(value: number) {
	return MIN_RELIEF_MM + clamp01(value) * (MAX_RELIEF_MM - MIN_RELIEF_MM)
}

function frameDegrees(frame: TerrainGeoFrame) {
	const latitudeRadius = frame.radiusKm / 111.32
	const longitudeScale = Math.max(1e-9, Math.cos((frame.lat * Math.PI) / 180))
	return {
		latitudeRadius,
		longitudeRadius: frame.radiusKm / (111.32 * longitudeScale),
	}
}

export function transformFrame(
	source: TerrainGeoFrame,
	view: TerrainGeoFrame,
): TerrainFrameTransform {
	const sourceDegrees = frameDegrees(source)
	const viewDegrees = frameDegrees(view)
	const sourceBearing = ((source.bearing || 0) * Math.PI) / 180
	const relativeRotation = (((view.bearing || 0) - (source.bearing || 0)) * Math.PI) / 180
	const longitudeOffset =
		(view.lng - source.lng) / (2 * sourceDegrees.longitudeRadius)
	const latitudeOffset =
		(view.lat - source.lat) / (2 * sourceDegrees.latitudeRadius)
	const cosine = Math.cos(-sourceBearing)
	const sine = Math.sin(-sourceBearing)
	return {
		scaleX: viewDegrees.longitudeRadius / sourceDegrees.longitudeRadius,
		scaleY: viewDegrees.latitudeRadius / sourceDegrees.latitudeRadius,
		offsetX: sourceBearing
			? longitudeOffset * cosine - latitudeOffset * sine
			: longitudeOffset,
		offsetY: sourceBearing
			? longitudeOffset * sine + latitudeOffset * cosine
			: latitudeOffset,
		rotation: relativeRotation,
	}
}

function smoothFraction(value: number) {
	return value * value * (3 - 2 * value)
}

function gridValue(frame: TerrainFrame, x: number, y: number) {
	const size = Math.max(1, frame.size || frame.data.length)
	const column = Math.min(size - 1, Math.max(0, x))
	const row = Math.min(size - 1, Math.max(0, y))
	const value = frame.data[row]?.[column]
	return Number.isFinite(value) ? Number(value) : 0
}

export function sampleFrameNormalized(frame: TerrainFrame, u: number, v: number) {
	const size = Math.max(1, frame.size || frame.data.length)
	const x = u * size - 0.5
	const y = (1 - v) * size - 0.5
	const x0 = Math.floor(x)
	const y0 = Math.floor(y)
	const fx = smoothFraction(x - x0)
	const fy = smoothFraction(y - y0)
	const top = gridValue(frame, x0, y0) * (1 - fx) + gridValue(frame, x0 + 1, y0) * fx
	const bottom =
		gridValue(frame, x0, y0 + 1) * (1 - fx) +
		gridValue(frame, x0 + 1, y0 + 1) * fx
	return top * (1 - fy) + bottom * fy
}

export function sampleFrameElevation(frame: TerrainFrame, u: number, v: number) {
	const range = frame.maxElev - frame.minElev
	return frame.minElev + sampleFrameNormalized(frame, u, v) * range
}

export function outerCoverage(u: number, v: number) {
	const outside = Math.max(-u, u - 1, -v, v - 1, 0)
	return 1 - clamp(outside / TERRAIN_EDGE_FADE, 0, 1)
}

function rotate(x: number, y: number, angle: number): readonly [number, number] {
	if (Math.abs(angle) < 1e-12) return [x, y]
	const cosine = Math.cos(angle)
	const sine = Math.sin(angle)
	return [x * cosine - y * sine, x * sine + y * cosine]
}

function mapViewUvToSource(
	u: number,
	v: number,
	transform: TerrainFrameTransform,
): readonly [number, number] {
	const centeredX = u - 0.5
	const centeredY = v - 0.5
	const [rotatedX, rotatedY] = rotate(
		centeredX * transform.scaleX,
		centeredY * transform.scaleY,
		transform.rotation,
	)
	return [
		rotatedX + 0.5 + transform.offsetX,
		rotatedY + 0.5 + transform.offsetY,
	]
}

function smoothIrregularSamples(
	values: Float64Array,
	uvs: ReadonlyArray<readonly [number, number]>,
	smoothing: number,
) {
	if (smoothing <= 0 || values.length <= 1) return values
	const radius = smoothing / Math.sqrt(values.length)
	if (radius <= 0) return values
	const cellSize = Math.max(radius, 1e-6)
	const gridSize = Math.ceil(1 / cellSize) + 1
	const buckets = new Map<number, number[]>()
	for (let index = 0; index < uvs.length; index++) {
		const [u, v] = uvs[index]
		const x = Math.min(gridSize - 1, Math.max(0, Math.floor(u / cellSize)))
		const y = Math.min(gridSize - 1, Math.max(0, Math.floor(v / cellSize)))
		const key = y * gridSize + x
		const bucket = buckets.get(key)
		if (bucket) bucket.push(index)
		else buckets.set(key, [index])
	}
	const result = new Float64Array(values.length)
	const radiusSquared = radius * radius
	const sigma = radius / 2
	const inverseTwoSigmaSquared = 1 / (2 * sigma * sigma)
	for (let index = 0; index < uvs.length; index++) {
		const [u, v] = uvs[index]
		const gridX = Math.min(gridSize - 1, Math.max(0, Math.floor(u / cellSize)))
		const gridY = Math.min(gridSize - 1, Math.max(0, Math.floor(v / cellSize)))
		let weightSum = 0
		let valueSum = 0
		for (let y = Math.max(0, gridY - 1); y <= Math.min(gridSize - 1, gridY + 1); y++) {
			for (let x = Math.max(0, gridX - 1); x <= Math.min(gridSize - 1, gridX + 1); x++) {
				for (const neighbor of buckets.get(y * gridSize + x) ?? []) {
					const deltaU = uvs[neighbor][0] - u
					const deltaV = uvs[neighbor][1] - v
					const distanceSquared = deltaU * deltaU + deltaV * deltaV
					if (distanceSquared > radiusSquared) continue
					const weight = Math.exp(-distanceSquared * inverseTwoSigmaSquared)
					weightSum += weight
					valueSum += values[neighbor] * weight
				}
			}
		}
		result[index] = weightSum > 0 ? valueSum / weightSum : values[index]
	}
	return result
}

export function sampleFramedTerrain(
	fine: TerrainFrame,
	coarse: TerrainFrame | null,
	view: TerrainGeoFrame,
	uvs: ReadonlyArray<readonly [number, number]>,
	smoothing: number,
) {
	const fineTransform = transformFrame(fine.frame, view)
	const coarseTransform = coarse ? transformFrame(coarse.frame, view) : null
	const samples = new Float64Array(uvs.length)
	for (let index = 0; index < uvs.length; index++) {
		const [u, v] = uvs[index]
		let elevation = fine.minElev
		if (coarse && coarseTransform) {
			const [coarseU, coarseV] = mapViewUvToSource(u, v, coarseTransform)
			const coverage = outerCoverage(coarseU, coarseV)
			if (coverage > 0) {
				elevation +=
					(sampleFrameElevation(coarse, coarseU, coarseV) - elevation) * coverage
			}
		}
		const [fineU, fineV] = mapViewUvToSource(u, v, fineTransform)
		const coverage = outerCoverage(fineU, fineV)
		if (coverage > 0) {
			elevation +=
				(sampleFrameElevation(fine, fineU, fineV) - elevation) * coverage
		}
		samples[index] = elevation
	}
	return smoothIrregularSamples(samples, uvs, smoothing)
}

