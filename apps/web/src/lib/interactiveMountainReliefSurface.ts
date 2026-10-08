import * as THREE from 'three'
import type {
	MountainReliefOptions,
	MountainSignetModel,
} from './referenceMountainSignet.ts'
import {
	reliefMillimeters,
	sampleFramedTerrain,
} from './referenceSignetTerrain.ts'

export type InteractiveReliefDetail = 'low' | 'medium' | 'high'

const DETAIL_SEGMENTS: Record<InteractiveReliefDetail, 64 | 128 | 256> = {
	low: 64,
	medium: 128,
	high: 256,
}

export interface InteractiveReliefBoundaryBinding {
	surfaceVertex: number
	a: number
	b: number
	c: number
	d: number
	wa: number
	wb: number
	wc: number
	wd: number
}

export interface InteractiveReliefSurface {
	geometry: THREE.BufferGeometry
	gridSegments: 64 | 128 | 256
	basePositions: Float32Array
	uvs: Array<readonly [number, number]>
	hostIndices: Uint32Array
	hostWeights: Float32Array
	boundaryBindings: InteractiveReliefBoundaryBinding[]
}

export interface InteractiveReliefHostGeometry {
	geometry: THREE.BufferGeometry
	removedTriangleCount: number
}

export function interactiveReliefSegments(detail: InteractiveReliefDetail) {
	return DETAIL_SEGMENTS[detail] ?? DETAIL_SEGMENTS.medium
}

function orderedFaceRadials(model: MountainSignetModel) {
	const [end, start] = [model.faceEdges[1], model.faceEdges[0]]
	const result: number[] = []
	let radial = end
	for (let guard = 0; guard <= model.radialCount; guard++) {
		result.push(radial)
		if (radial === start) break
		radial = (radial + 1) % model.radialCount
	}
	return result
}

function interpolationCoordinate(index: number, segments: number, sourceCount: number) {
	const scaled = (index / segments) * (sourceCount - 1)
	const lower = Math.floor(scaled)
	return {
		lower,
		upper: Math.min(sourceCount - 1, lower + 1),
		amount: scaled - lower,
	}
}

function weightedValue(
	values: ArrayLike<number>,
	indices: ArrayLike<number>,
	weights: ArrayLike<number>,
	axis: number,
) {
	let value = 0
	for (let corner = 0; corner < 4; corner++) {
		value += values[indices[corner] * 3 + axis] * weights[corner]
	}
	return value
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

function copySharedAttributes(
	target: THREE.BufferGeometry,
	source: THREE.BufferGeometry,
) {
	for (const [name, attribute] of Object.entries(source.attributes)) {
		target.setAttribute(name, attribute)
	}
	target.boundingBox = source.boundingBox?.clone() ?? null
	target.boundingSphere = source.boundingSphere?.clone() ?? null
}

export function createInteractiveReliefSurface(
	host: MountainSignetModel,
	detail: InteractiveReliefDetail,
): InteractiveReliefSurface {
	const gridSegments = interactiveReliefSegments(detail)
	const gridSize = gridSegments + 1
	const vertexCount = gridSize * gridSize
	const radials = orderedFaceRadials(host)
	const sections = host.sectionSurfaceIndices
	if (radials.length < 2 || sections.length < 2) {
		throw new Error('Mountain face requires at least a two by two host grid')
	}

	const uvByHostVertex = new Map<number, readonly [number, number]>()
	for (let index = 0; index < host.faceVertexIndices.length; index++) {
		uvByHostVertex.set(host.faceVertexIndices[index], host.faceUvs[index])
	}

	const basePositions = new Float32Array(vertexCount * 3)
	const uvAttribute = new Float32Array(vertexCount * 2)
	const hostIndices = new Uint32Array(vertexCount * 4)
	const hostWeights = new Float32Array(vertexCount * 4)
	const uvs: Array<readonly [number, number]> = new Array(vertexCount)
	const boundaryBindings: InteractiveReliefBoundaryBinding[] = []

	for (let row = 0; row < gridSize; row++) {
		const radial = interpolationCoordinate(row, gridSegments, radials.length)
		for (let column = 0; column < gridSize; column++) {
			const section = interpolationCoordinate(column, gridSegments, sections.length)
			const vertex = row * gridSize + column
			const bindingOffset = vertex * 4
			const a = radials[radial.lower] * host.sectionCount + sections[section.lower]
			const b = radials[radial.lower] * host.sectionCount + sections[section.upper]
			const c = radials[radial.upper] * host.sectionCount + sections[section.upper]
			const d = radials[radial.upper] * host.sectionCount + sections[section.lower]
			const wa = (1 - radial.amount) * (1 - section.amount)
			const wb = (1 - radial.amount) * section.amount
			const wc = radial.amount * section.amount
			const wd = radial.amount * (1 - section.amount)
			const indices = [a, b, c, d]
			const weights = [wa, wb, wc, wd]
			hostIndices.set(indices, bindingOffset)
			hostWeights.set(weights, bindingOffset)

			for (let axis = 0; axis < 3; axis++) {
				basePositions[vertex * 3 + axis] = weightedValue(
					host.originalPositions,
					indices,
					weights,
					axis,
				)
			}
			let u = 0
			let v = 0
			for (let corner = 0; corner < 4; corner++) {
				const uv = uvByHostVertex.get(indices[corner])
				if (!uv) throw new Error('Missing host face UV')
				u += uv[0] * weights[corner]
				v += uv[1] * weights[corner]
			}
			uvs[vertex] = [u, v]
			uvAttribute[vertex * 2] = u
			uvAttribute[vertex * 2 + 1] = v

			if (
				row === 0 ||
				row === gridSegments ||
				column === 0 ||
				column === gridSegments
			) {
				boundaryBindings.push({
					surfaceVertex: vertex,
					a,
					b,
					c,
					d,
					wa,
					wb,
					wc,
					wd,
				})
			}
		}
	}

	const IndexArray = vertexCount <= 65535 ? Uint16Array : Uint32Array
	const indices = new IndexArray(gridSegments * gridSegments * 6)
	let cursor = 0
	for (let row = 0; row < gridSegments; row++) {
		for (let column = 0; column < gridSegments; column++) {
			const a = row * gridSize + column
			const b = a + 1
			const d = (row + 1) * gridSize + column
			const c = d + 1
			indices[cursor++] = a
			indices[cursor++] = b
			indices[cursor++] = c
			indices[cursor++] = a
			indices[cursor++] = c
			indices[cursor++] = d
		}
	}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(basePositions.slice(), 3))
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvAttribute, 2))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()

	return {
		geometry,
		gridSegments,
		basePositions,
		uvs,
		hostIndices,
		hostWeights,
		boundaryBindings,
	}
}

export function updateInteractiveReliefSurface(
	surface: InteractiveReliefSurface,
	host: MountainSignetModel,
	options: MountainReliefOptions,
) {
	const samples = sampleFramedTerrain(
		options.fine,
		options.coarse,
		options.view,
		surface.uvs,
		options.smoothing,
	)
	const range = reliefRange(samples)
	const span = range.maximum - range.minimum
	const height = reliefMillimeters(options.relief)
	const position = surface.geometry.getAttribute('position') as THREE.BufferAttribute
	const positions = position.array as Float32Array
	positions.set(surface.basePositions)
	if (span > 1e-12) {
		for (let vertex = 0; vertex < samples.length; vertex++) {
			positions[vertex * 3 + 1] +=
				((samples[vertex] - range.minimum) / span) * height
		}
	}

	const hostPositions = (
		host.geometry.getAttribute('position') as THREE.BufferAttribute
	).array as Float32Array
	for (const binding of surface.boundaryBindings) {
		const indices = [binding.a, binding.b, binding.c, binding.d]
		const weights = [binding.wa, binding.wb, binding.wc, binding.wd]
		for (let axis = 0; axis < 3; axis++) {
			positions[binding.surfaceVertex * 3 + axis] = weightedValue(
				hostPositions,
				indices,
				weights,
				axis,
			)
		}
	}

	position.needsUpdate = true
	surface.geometry.computeVertexNormals()
	const normal = surface.geometry.getAttribute('normal') as THREE.BufferAttribute
	const normals = normal.array as Float32Array
	const hostNormals = (
		host.geometry.getAttribute('normal') as THREE.BufferAttribute
	).array as Float32Array
	for (const binding of surface.boundaryBindings) {
		const indices = [binding.a, binding.b, binding.c, binding.d]
		const weights = [binding.wa, binding.wb, binding.wc, binding.wd]
		const x = weightedValue(hostNormals, indices, weights, 0)
		const y = weightedValue(hostNormals, indices, weights, 1)
		const z = weightedValue(hostNormals, indices, weights, 2)
		const length = Math.hypot(x, y, z) || 1
		normals[binding.surfaceVertex * 3] = x / length
		normals[binding.surfaceVertex * 3 + 1] = y / length
		normals[binding.surfaceVertex * 3 + 2] = z / length
	}
	normal.needsUpdate = true
	surface.geometry.computeBoundingBox()
	surface.geometry.computeBoundingSphere()
	return surface
}

export function createInteractiveReliefHostGeometry(
	host: MountainSignetModel,
): InteractiveReliefHostGeometry {
	const sourceIndex = host.geometry.getIndex()
	if (!sourceIndex) throw new Error('Mountain host requires indexed geometry')
	const faceRadials = new Set(host.faceRadialIndices)
	const surfaceSections = new Set(host.sectionSurfaceIndices)
	const kept: number[] = []
	let removedTriangleCount = 0
	let offset = 0
	for (let radial = 0; radial < host.radialCount; radial++) {
		const nextRadial = (radial + 1) % host.radialCount
		for (let section = 0; section < host.sectionCount; section++) {
			const nextSection = (section + 1) % host.sectionCount
			const covered =
				faceRadials.has(radial) &&
				faceRadials.has(nextRadial) &&
				surfaceSections.has(section) &&
				surfaceSections.has(nextSection)
			if (covered) {
				removedTriangleCount += 2
			} else {
				for (let corner = 0; corner < 6; corner++) {
					kept.push(sourceIndex.getX(offset + corner))
				}
			}
			offset += 6
		}
	}
	const IndexArray = host.geometry.getAttribute('position').count <= 65535
		? Uint16Array
		: Uint32Array
	const geometry = new THREE.BufferGeometry()
	copySharedAttributes(geometry, host.geometry)
	geometry.setIndex(new THREE.BufferAttribute(new IndexArray(kept), 1))
	return { geometry, removedTriangleCount }
}

export function syncInteractiveReliefHostGeometry(
	renderedHost: InteractiveReliefHostGeometry,
	host: MountainSignetModel,
) {
	copySharedAttributes(renderedHost.geometry, host.geometry)
	return renderedHost
}
