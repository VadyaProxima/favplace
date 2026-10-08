import * as THREE from 'three'
import {
	reliefMillimeters,
	sampleFramedTerrain,
	type TerrainFrame,
	type TerrainGeoFrame,
} from './referenceSignetTerrain.ts'

const PHI = (1 + Math.sqrt(5)) / 2
const TWO_PI = Math.PI * 2

export function mountainResolutionForQuality(quality: 'preview' | 'exact') {
	return quality === 'exact' ? 0.05 : 0.2
}

export type RingWeight = 'subtle' | 'classic' | 'statement'
export type BandProfile = 'flat' | 'classic' | 'd-shaped'
export type ShoulderStyle = 'straight' | 'classic' | 'curved'

export interface MountainSignetOptions {
	ringDiameter: number
	resolution: 0.05 | 0.2
	weight: RingWeight
	bandProfile: BandProfile
	shoulderStyle: ShoulderStyle
}

export interface MountainReliefOptions {
	fine: TerrainFrame
	coarse: TerrainFrame | null
	view: TerrainGeoFrame
	relief: number
	smoothing: 0 | 2 | 4
}

export type DeformedMountainSignetOptions = Omit<MountainSignetOptions, 'resolution'> &
	MountainReliefOptions

interface CubicPoint {
	x: number
	y: number
}

interface WeightPreset {
	bandWidthFactor: number
	faceWidthFactor: number
	faceLengthFactor: number
}

interface ProfilePreset {
	innerTransition: number
	edgeTransition: number
	outerTransition: number
}

export interface FaceShoulderPair {
	face: number
	shoulder: number
}

export interface MountainSignetModel {
	geometry: THREE.BufferGeometry
	originalPositions: Float32Array
	faceVertexIndices: number[]
	faceUvs: Array<readonly [number, number]>
	shoulderVertexIndices: number[]
	shoulderUvs: Array<readonly [number, number]>
	shoulderDistances: number[]
	faceShoulderPairs: FaceShoulderPair[]
	bottomBandVertexIndices: number[]
	publicProps: {
		innerDiameter: number
		innerCircumference: number
		bandHalfWidth: number
		faceHalfWidth: number
		faceHalfLength: number
	}
	radialCount: number
	sectionCount: number
	sectionSurfaceIndices: number[]
	faceRadialIndices: number[]
	shoulderSides: [number[], number[]]
	faceEdges: [number, number]
}

const WEIGHT_PRESETS: Record<RingWeight, WeightPreset> = {
	subtle: {
		bandWidthFactor: Math.pow(PHI, -3),
		faceWidthFactor: Math.PI / 4,
		faceLengthFactor: 1 / Math.PI,
	},
	classic: {
		bandWidthFactor: Math.pow(PHI, -3),
		faceWidthFactor: 0.5,
		faceLengthFactor: 0.5,
	},
	statement: {
		bandWidthFactor: 1 / 3,
		faceWidthFactor: 2 / 3,
		faceLengthFactor: 2 / 3,
	},
}

const PROFILE_PRESETS: Record<BandProfile, ProfilePreset> = {
	flat: { innerTransition: 0.99, edgeTransition: 0.99, outerTransition: 0.01 },
	classic: { innerTransition: 1, edgeTransition: 0.5, outerTransition: 0 },
	'd-shaped': { innerTransition: 0.1, edgeTransition: 0.1, outerTransition: 0.01 },
}

const SHOULDER_CURVES: Record<ShoulderStyle, readonly CubicPoint[]> = {
	straight: [
		{ x: 0, y: 0 },
		{ x: 0.5, y: 0 },
		{ x: 1, y: 1 },
		{ x: 1, y: 1 },
	],
	classic: [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 0.9, y: 0.9 },
		{ x: 1, y: 1 },
	],
	curved: [
		{ x: 0, y: 0 },
		{ x: 0.9, y: 0 },
		{ x: 0.9, y: 0.1 },
		{ x: 1, y: 1 },
	],
}

const RADIAL_SHOULDER_CURVE: readonly CubicPoint[] = [
	{ x: 0, y: 0 },
	{ x: 0.9, y: 0 },
	{ x: 1, y: 1 },
	{ x: 1, y: 1 },
]

function finitePositive(value: number, fallback: number) {
	return Number.isFinite(value) && value > 0 ? value : fallback
}

function cubicCoordinate(
	t: number,
	p0: number,
	p1: number,
	p2: number,
	p3: number,
) {
	const inverse = 1 - t
	return (
		inverse * inverse * inverse * p0 +
		3 * inverse * inverse * t * p1 +
		3 * inverse * t * t * p2 +
		t * t * t * p3
	)
}

function cubicYForX(points: readonly CubicPoint[], x: number) {
	const target = Math.min(1, Math.max(0, x))
	let low = 0
	let high = 1
	let t = 0.5
	for (let iteration = 0; iteration < 64; iteration++) {
		const current = cubicCoordinate(
			t,
			points[0].x,
			points[1].x,
			points[2].x,
			points[3].x,
		)
		if (Math.abs(current - target) < 1e-7) break
		if (current > target) high = t
		else low = t
		t = (low + high) / 2
	}
	return cubicCoordinate(
		t,
		points[0].y,
		points[1].y,
		points[2].y,
		points[3].y,
	)
}

function quadraticPoint(
	t: number,
	p0: readonly [number, number],
	p1: readonly [number, number],
	p2: readonly [number, number],
): readonly [number, number] {
	const inverse = 1 - t
	return [
		inverse * inverse * p0[0] + 2 * inverse * t * p1[0] + t * t * p2[0],
		inverse * inverse * p0[1] + 2 * inverse * t * p1[1] + t * t * p2[1],
	]
}

function linePoint(
	t: number,
	p0: readonly [number, number],
	p1: readonly [number, number],
): readonly [number, number] {
	return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]
}

function resamplePolyline(
	points: ReadonlyArray<readonly [number, number]>,
	count: number,
) {
	const cumulative = new Float64Array(points.length)
	for (let index = 1; index < points.length; index++) {
		cumulative[index] =
			cumulative[index - 1] +
			Math.hypot(
				points[index][0] - points[index - 1][0],
				points[index][1] - points[index - 1][1],
			)
	}
	const total = cumulative[cumulative.length - 1]
	const result: Array<readonly [number, number]> = []
	let segment = 1
	for (let index = 0; index < count; index++) {
		const distance = count === 1 ? 0 : (index / (count - 1)) * total
		while (segment < cumulative.length - 1 && cumulative[segment] < distance) segment++
		const before = cumulative[segment - 1]
		const after = cumulative[segment]
		const amount = after > before ? (distance - before) / (after - before) : 0
		result.push(linePoint(amount, points[segment - 1], points[segment]))
	}
	return result
}

function buildHalfSection(
	count: number,
	bandHalfWidth: number,
	bandThickness: number,
	profile: ProfilePreset,
	sectionResolution: number,
) {
	const halfStep = sectionResolution * 0.5
	const p0 = [halfStep, 0] as const
	const p1 = [bandHalfWidth * (1 - profile.innerTransition), 0] as const
	const p2 = [bandHalfWidth, 0] as const
	const p3 = [bandHalfWidth, bandThickness * profile.edgeTransition] as const
	const p4 = [bandHalfWidth, bandThickness] as const
	const p5 = [bandHalfWidth * profile.outerTransition, bandThickness] as const
	const p6 = [halfStep, bandThickness] as const
	const dense: Array<readonly [number, number]> = []
	const append = (point: readonly [number, number]) => {
		const previous = dense[dense.length - 1]
		if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) dense.push(point)
	}
	for (let step = 0; step <= 24; step++) append(linePoint(step / 24, p0, p1))
	for (let step = 1; step <= 48; step++) append(quadraticPoint(step / 48, p1, p2, p3))
	for (let step = 1; step <= 48; step++) append(quadraticPoint(step / 48, p3, p4, p5))
	for (let step = 1; step <= 24; step++) append(linePoint(step / 24, p5, p6))
	return resamplePolyline(dense, count)
}

function smoothOneDimensional(values: number[], radius: number) {
	if (radius <= 0 || values.length === 0) return values.slice()
	const result = new Array<number>(values.length)
	const rounded = Math.max(1, Math.round(radius))
	const sigma = rounded / 2
	const inverseTwoSigmaSquared = 1 / (2 * sigma * sigma)
	for (let index = 0; index < values.length; index++) {
		let weightSum = 0
		let valueSum = 0
		for (
			let neighbor = Math.max(0, index - rounded);
			neighbor <= Math.min(values.length - 1, index + rounded);
			neighbor++
		) {
			const delta = neighbor - index
			const weight = Math.exp(-delta * delta * inverseTwoSigmaSquared)
			weightSum += weight
			valueSum += values[neighbor] * weight
		}
		result[index] = valueSum / weightSum
	}
	return result
}

function squareUvProjection(
	positions: Float32Array,
	indices: number[],
) {
	let minimumX = Infinity
	let maximumX = -Infinity
	let minimumZ = Infinity
	let maximumZ = -Infinity
	for (const index of indices) {
		minimumX = Math.min(minimumX, positions[index * 3])
		maximumX = Math.max(maximumX, positions[index * 3])
		minimumZ = Math.min(minimumZ, -positions[index * 3 + 2])
		maximumZ = Math.max(maximumZ, -positions[index * 3 + 2])
	}
	const width = maximumX - minimumX
	const height = maximumZ - minimumZ
	const span = Math.max(width, height, 1e-9)
	const offsetU = (1 - width / span) * 0.5
	const offsetV = (1 - height / span) * 0.5
	return (index: number) =>
		[
			(positions[index * 3] - minimumX) / span + offsetU,
			(-positions[index * 3 + 2] - minimumZ) / span + offsetV,
		] as const
}

export function buildMountainSignet(options: MountainSignetOptions): MountainSignetModel {
	const ringDiameter = finitePositive(options.ringDiameter, 17)
	const resolution = options.resolution === 0.05 ? 0.05 : 0.2
	const weight = WEIGHT_PRESETS[options.weight] ?? WEIGHT_PRESETS.classic
	const profile = PROFILE_PRESETS[options.bandProfile] ?? PROFILE_PRESETS.classic
	const shoulderCurve = SHOULDER_CURVES[options.shoulderStyle] ?? SHOULDER_CURVES.classic
	const innerRadius = ringDiameter / 2
	const bandThickness = ringDiameter * Math.pow(PHI, -5)
	const outerRadius = innerRadius + bandThickness
	const bandHalfWidth = weight.bandWidthFactor * ((innerRadius + outerRadius) / 2)
	const faceHalfWidth = outerRadius * weight.faceWidthFactor
	const faceHalfLength = outerRadius * weight.faceLengthFactor
	const faceTransitionAngle = Math.atan(faceHalfWidth / outerRadius)
	const radialHalfCount = Math.max(
		3,
		Math.round(Math.PI / Math.atan(resolution / outerRadius)),
	)
	const radialCount = radialHalfCount * 2
	const sectionHalfCount = Math.max(
		3,
		Math.ceil((radialCount * faceHalfLength) / (2 * outerRadius)),
	)
	const sectionCount = sectionHalfCount * 2
	const sectionResolution = (bandHalfWidth * Math.PI) / sectionCount
	const halfSection = buildHalfSection(
		sectionHalfCount,
		bandHalfWidth,
		bandThickness,
		profile,
		sectionResolution,
	)
	const section = [
		...halfSection,
		...halfSection
			.slice()
			.reverse()
			.map(point => [-point[0], point[1]] as const),
	]
	const sectionSurfaceIndices: number[] = []
	const edgeTransitionHeight = bandThickness * profile.edgeTransition
	for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++) {
		if (section[sectionIndex][1] > edgeTransitionHeight) {
			sectionSurfaceIndices.push(sectionIndex)
		}
	}
	const radialAngles = new Float64Array(radialCount)
	const faceRadialIndices: number[] = []
	const faceMask = new Uint8Array(radialCount)
	const radialStep = TWO_PI / radialCount
	for (let radial = 0; radial < radialCount; radial++) {
		const angle = radialStep * (radial + 0.5)
		radialAngles[radial] = angle
		if (angle <= faceTransitionAngle || angle >= TWO_PI - faceTransitionAngle) {
			faceMask[radial] = 1
			faceRadialIndices.push(radial)
		}
	}
	const startFaceEdge = faceRadialIndices.filter(index => index < radialCount / 2).at(-1) ?? 0
	const endFaceEdge = faceRadialIndices.find(index => index > radialCount / 2) ?? radialCount - 1
	const shoulderForward: number[] = []
	const shoulderBackward: number[] = []
	const midpoint = Math.floor(radialCount / 2)
	for (let radial = startFaceEdge + 1; radial <= midpoint; radial++) shoulderForward.push(radial)
	for (let radial = endFaceEdge - 1; radial > midpoint; radial--) shoulderBackward.push(radial)
	if (endFaceEdge - 1 === midpoint && shoulderBackward.length === 0) {
		shoulderBackward.push(midpoint)
	}

	const positions = new Float32Array(radialCount * sectionCount * 3)
	for (let radial = 0; radial < radialCount; radial++) {
		const angle = radialAngles[radial]
		const cosine = Math.cos(angle)
		const sine = Math.sin(angle)
		const absoluteAngle = Math.min(angle, TWO_PI - angle)
		let radialScale = 1
		let axialScale = 1
		if (faceMask[radial]) {
			const lateral = outerRadius * Math.tan(angle)
			radialScale =
				(Math.hypot(lateral, outerRadius) - innerRadius) / bandThickness
			axialScale = faceHalfLength / bandHalfWidth
		} else {
			const progress = Math.min(
				1,
				Math.max(0, (absoluteAngle - faceTransitionAngle) / (Math.PI - faceTransitionAngle)),
			)
			const faceRadialScale =
				(Math.hypot(faceHalfWidth, outerRadius) - innerRadius) / bandThickness
			radialScale =
				1 +
				(faceRadialScale - 1) * cubicYForX(RADIAL_SHOULDER_CURVE, 1 - progress)
			axialScale =
				1 +
				(faceHalfLength / bandHalfWidth - 1) *
					cubicYForX(shoulderCurve, 1 - progress)
		}
		for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++) {
			const vertex = radial * sectionCount + sectionIndex
			const [sectionX, sectionY] = section[sectionIndex]
			positions[vertex * 3] = sectionX * axialScale
			positions[vertex * 3 + 1] =
				innerRadius * cosine + sectionY * radialScale * cosine
			positions[vertex * 3 + 2] =
				innerRadius * sine + sectionY * radialScale * sine
		}
	}

	const triangleIndexCount = radialCount * sectionCount * 6
	const IndexArray = positions.length / 3 <= 65535 ? Uint16Array : Uint32Array
	const indices = new IndexArray(triangleIndexCount)
	let cursor = 0
	for (let radial = 0; radial < radialCount; radial++) {
		const nextRadial = (radial + 1) % radialCount
		for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex++) {
			const nextSection = (sectionIndex + 1) % sectionCount
			const a = radial * sectionCount + sectionIndex
			const b = nextRadial * sectionCount + sectionIndex
			const c = nextRadial * sectionCount + nextSection
			const d = radial * sectionCount + nextSection
			indices[cursor++] = b
			indices[cursor++] = a
			indices[cursor++] = d
			indices[cursor++] = c
			indices[cursor++] = b
			indices[cursor++] = d
		}
	}
	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()

	const faceVertexIndices: number[] = []
	for (const radial of faceRadialIndices) {
		for (const sectionIndex of sectionSurfaceIndices) {
			faceVertexIndices.push(radial * sectionCount + sectionIndex)
		}
	}
	const projectUv = squareUvProjection(positions, faceVertexIndices)
	const faceUvs = faceVertexIndices.map(projectUv)
	const shoulderVertexIndices: number[] = []
	const shoulderUvs: Array<readonly [number, number]> = []
	const shoulderDistances: number[] = []
	for (const radials of [shoulderForward, shoulderBackward]) {
		for (let radialOffset = 0; radialOffset < radials.length; radialOffset++) {
			const distance = radials.length <= 1 ? 1 : radialOffset / (radials.length - 1)
			for (const sectionIndex of sectionSurfaceIndices) {
				const vertex = radials[radialOffset] * sectionCount + sectionIndex
				shoulderVertexIndices.push(vertex)
				shoulderUvs.push(projectUv(vertex))
				shoulderDistances.push(distance)
			}
		}
	}
	const faceShoulderPairs: FaceShoulderPair[] = []
	for (const sectionIndex of sectionSurfaceIndices) {
		faceShoulderPairs.push({
			face: startFaceEdge * sectionCount + sectionIndex,
			shoulder: (startFaceEdge + 1) * sectionCount + sectionIndex,
		})
		faceShoulderPairs.push({
			face: endFaceEdge * sectionCount + sectionIndex,
			shoulder: (endFaceEdge - 1) * sectionCount + sectionIndex,
		})
	}
	const bottomBandVertexIndices = sectionSurfaceIndices.map(
		sectionIndex => midpoint * sectionCount + sectionIndex,
	)
	return {
		geometry,
		originalPositions: positions.slice(),
		faceVertexIndices,
		faceUvs,
		shoulderVertexIndices,
		shoulderUvs,
		shoulderDistances,
		faceShoulderPairs,
		bottomBandVertexIndices,
		publicProps: {
			innerDiameter: ringDiameter,
			innerCircumference: ringDiameter * Math.PI,
			bandHalfWidth,
			faceHalfWidth,
			faceHalfLength,
		},
		radialCount,
		sectionCount,
		sectionSurfaceIndices,
		faceRadialIndices,
		shoulderSides: [shoulderForward, shoulderBackward],
		faceEdges: [startFaceEdge, endFaceEdge],
	}
}

function reliefRange(samples: Float64Array) {
	let minimum = Infinity
	let maximum = -Infinity
	for (const sample of samples) {
		minimum = Math.min(minimum, sample)
		maximum = Math.max(maximum, sample)
	}
	return { minimum, maximum }
}

function remapRelief(
	samples: Float64Array,
	height: number,
	range = reliefRange(samples),
	clampToFaceRange = false,
) {
	const span = range.maximum - range.minimum
	const values = new Float64Array(samples.length)
	if (!(span > 1e-12)) return values
	for (let index = 0; index < samples.length; index++) {
		const normalized = (samples[index] - range.minimum) / span
		values[index] =
			(clampToFaceRange ? Math.min(1, Math.max(0, normalized)) : normalized) * height
	}
	return values
}

function shoulderBlend(distanceFromFace: number) {
	const remaining = 1 - Math.min(1, Math.max(0, distanceFromFace))
	const normalized = (remaining - 0.8) / 0.2
	if (normalized <= 0) return 0
	if (normalized >= 1) return 1
	return normalized * normalized
}

export function deformMountainSignet(
	model: MountainSignetModel,
	options: MountainReliefOptions,
) {
	const position = model.geometry.getAttribute('position') as THREE.BufferAttribute
	const positions = position.array as Float32Array
	positions.set(model.originalPositions)
	const samples = sampleFramedTerrain(
		options.fine,
		options.coarse,
		options.view,
		model.faceUvs,
		options.smoothing,
	)
	const height = reliefMillimeters(options.relief)
	const faceRange = reliefRange(samples)
	const relief = remapRelief(samples, height, faceRange)
	const shoulderSamples = sampleFramedTerrain(
		options.fine,
		options.coarse,
		options.view,
		model.shoulderUvs,
		options.smoothing,
	)
	const shoulderRelief = remapRelief(
		shoulderSamples,
		height,
		faceRange,
		true,
	)
	const displacement = new Float64Array(position.count)
	for (let index = 0; index < model.faceVertexIndices.length; index++) {
		const vertex = model.faceVertexIndices[index]
		displacement[vertex] = relief[index]
		positions[vertex * 3 + 1] = model.originalPositions[vertex * 3 + 1] + relief[index]
	}
	const [firstFaceEdge, secondFaceEdge] = model.faceEdges
	const firstEdge = smoothOneDimensional(
		model.sectionSurfaceIndices.map(
			sectionIndex => displacement[firstFaceEdge * model.sectionCount + sectionIndex],
		),
		6,
	)
	const secondEdge = smoothOneDimensional(
		model.sectionSurfaceIndices.map(
			sectionIndex => displacement[secondFaceEdge * model.sectionCount + sectionIndex],
		),
		6,
	)
	const edges = [firstEdge, secondEdge]
	for (let sideIndex = 0; sideIndex < model.faceEdges.length; sideIndex++) {
		const radial = model.faceEdges[sideIndex]
		const edge = edges[sideIndex]
		for (let sectionOffset = 0; sectionOffset < model.sectionSurfaceIndices.length; sectionOffset++) {
			const vertex =
				radial * model.sectionCount + model.sectionSurfaceIndices[sectionOffset]
			displacement[vertex] = edge[sectionOffset]
			positions[vertex * 3 + 1] = model.originalPositions[vertex * 3 + 1] + edge[sectionOffset]
		}
	}
	let shoulderCursor = 0
	for (let sideIndex = 0; sideIndex < model.shoulderSides.length; sideIndex++) {
		const radials = model.shoulderSides[sideIndex]
		const edge = edges[sideIndex]
		for (let radialOffset = 0; radialOffset < radials.length; radialOffset++) {
			const distance = radials.length <= 1 ? 1 : radialOffset / (radials.length - 1)
			const blend = shoulderBlend(distance)
			const contextBlend =
				radialOffset === 0
					? 0
					: Math.min(1, radialOffset / Math.max(1, Math.round(radials.length * 0.05)))
			const radial = radials[radialOffset]
			for (let sectionOffset = 0; sectionOffset < model.sectionSurfaceIndices.length; sectionOffset++) {
				const vertex =
					radial * model.sectionCount + model.sectionSurfaceIndices[sectionOffset]
				const contextAmount = shoulderRelief[shoulderCursor++]
				const terrainAmount =
					edge[sectionOffset] * (1 - contextBlend) + contextAmount * contextBlend
				const amount = terrainAmount * blend
				displacement[vertex] = amount
				positions[vertex * 3 + 1] = model.originalPositions[vertex * 3 + 1] + amount
			}
		}
	}
	position.needsUpdate = true
	model.geometry.computeVertexNormals()
	model.geometry.computeBoundingBox()
	model.geometry.computeBoundingSphere()
	return model.geometry
}

export function buildDeformedMountainSignet(
	options: DeformedMountainSignetOptions,
	quality: 'preview' | 'exact',
) {
	const model = buildMountainSignet({
		ringDiameter: options.ringDiameter,
		resolution: mountainResolutionForQuality(quality),
		weight: options.weight,
		bandProfile: options.bandProfile,
		shoulderStyle: options.shoulderStyle,
	})
	deformMountainSignet(model, options)
	return model
}

export function createInteractiveMountainSignet(
	options: Omit<MountainSignetOptions, 'resolution'>,
) {
	return buildMountainSignet({
		...options,
		resolution: mountainResolutionForQuality('preview'),
	})
}

export function updateInteractiveMountainSignet(
	model: MountainSignetModel,
	options: MountainReliefOptions,
) {
	deformMountainSignet(model, options)
	return model
}

export function vertexDisplacements(model: MountainSignetModel) {
	const positions = (
		model.geometry.getAttribute('position') as THREE.BufferAttribute
	).array as Float32Array
	const result = new Float64Array(positions.length / 3)
	for (let vertex = 0; vertex < result.length; vertex++) {
		result[vertex] = positions[vertex * 3 + 1] - model.originalPositions[vertex * 3 + 1]
	}
	return result
}

export function watertightReport(geometry: THREE.BufferGeometry) {
	const index = geometry.getIndex()
	if (!index) return { boundaryEdges: Infinity, nonManifoldEdges: Infinity }
	const counts = new Map<string, number>()
	for (let offset = 0; offset < index.count; offset += 3) {
		for (const [a, b] of [
			[index.getX(offset), index.getX(offset + 1)],
			[index.getX(offset + 1), index.getX(offset + 2)],
			[index.getX(offset + 2), index.getX(offset)],
		] as const) {
			const key = a < b ? `${a}:${b}` : `${b}:${a}`
			counts.set(key, (counts.get(key) ?? 0) + 1)
		}
	}
	let boundaryEdges = 0
	let nonManifoldEdges = 0
	for (const count of counts.values()) {
		if (count === 1) boundaryEdges++
		else if (count !== 2) nonManifoldEdges++
	}
	return { boundaryEdges, nonManifoldEdges }
}
