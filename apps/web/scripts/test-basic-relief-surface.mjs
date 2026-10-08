import assert from 'node:assert/strict'
import test from 'node:test'

import * as relief from '../src/lib/basicReliefSurface.ts'

test('outer context keeps terrain depth until its hairline seating seam', () => {
	const xSegments = 244
	const zSegments = 4
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[0, 1],
			[0, 1],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2.2,
			rz: 1.1,
			innerRx: 2,
			innerRz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: xSegments,
			angularSegments: zSegments,
			innerFootprintRatio: 1 / 1.22,
			edgeDrop: 0.3,
			fadeReliefOnShoulder: true,
		},
	)

	const rowSize = xSegments + 1
	const leftEdgeY = surface.positions[((zSegments / 2) * rowSize) * 3 + 1]
	const shoulderMidY =
		surface.positions[((zSegments / 2) * rowSize + 11) * 3 + 1]
	assert.ok(shoulderMidY < 4.65)
	assert.ok(Math.abs(leftEdgeY - 4.7) < 1e-5)
})

test('extended terrain follows the sampled host shoulder instead of a floating plane', () => {
	const xSegments = 10
	const zSegments = 4
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[1, 1],
			[1, 1],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2.2,
			rz: 1.1,
			innerRx: 2,
			innerRz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: xSegments,
			angularSegments: zSegments,
			innerFootprintRatio: 0.8,
			edgeDrop: 0.3,
			baseHeightAt: (x, z) => 5 - Math.abs(x) * 0.1 - Math.abs(z) * 0.05,
		},
	)

	const rowSize = xSegments + 1
	const rightMiddle = (zSegments / 2) * rowSize + xSegments
	assert.ok(Math.abs(surface.positions[rightMiddle * 3 + 1] - 4.78) < 1e-5)
})

test('projection hits below the upper shoulder are rejected instead of creating fins', () => {
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[1, 1],
			[1, 1],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2.2,
			rz: 1.1,
			innerRx: 2,
			innerRz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: 10,
			angularSegments: 4,
			innerFootprintRatio: 0.8,
			edgeDrop: 0.3,
			minimumBaseY: 4.6,
			baseHeightAt: () => 3,
		},
	)

	const rowSize = 11
	const rightMiddle = 2 * rowSize + 10
	assert.ok(Math.abs(surface.positions[rightMiddle * 3 + 1] - 4.7) < 1e-5)
})

test('terrain maximum is the ring surface and every other sample is carved inward', () => {
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[0, 1],
			[0, 1],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: 4,
			angularSegments: 8,
		},
	)

	assert.equal(surface.topVertexCount, 45)
	assert.ok([...surface.positions].every(Number.isFinite))
	const topYs = []
	for (let vertex = 0; vertex < surface.topVertexCount; vertex++) {
		topYs.push(surface.positions[vertex * 3 + 1])
	}
	assert.ok(Math.min(...topYs) < 4.76)
	assert.equal(Math.max(...topYs), 5)
	assert.ok(topYs.every(value => value <= 5))
	assert.equal(surface.sourceMaximum, 1)
	assert.equal(surface.minCarveOffset, -1)
	assert.equal(surface.maxCarveOffset, 0)
	assert.ok(surface.indices.length > 0)
})

test('terrain geometry contains only the visible top skin and no cut-off perimeter wall', () => {
	const radialSegments = 4
	const angularSegments = 8
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[0, 1],
			[0.25, 0.75],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments,
			angularSegments,
		},
	)

	assert.equal(
		surface.positions.length / 3,
		(radialSegments + 1) * (angularSegments + 1),
	)
	const topTriangles = radialSegments * angularSegments * 2
	assert.equal(surface.indices.length, topTriangles * 3)
})

test('deprecated perimeter seam inputs never append a visible relief wall', () => {
	const radialSegments = 4
	const angularSegments = 8
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[0, 1],
			[0.25, 0.75],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments,
			angularSegments,
			perimeterSkirtDepth: 0.4,
			perimeterSkirtInset: 0.1,
		},
	)

	assert.equal(surface.topVertexCount, 45)
	assert.equal(surface.positions.length / 3, surface.topVertexCount)
	assert.equal(
		surface.indices.length,
		radialSegments * angularSegments * 2 * 3,
	)
})

test('terrain uses a regular grid instead of a radial fan that invents center creases', () => {
	const xSegments = 6
	const zSegments = 10
	const surface = relief.buildCushionReliefSurfaceData(
		Array.from({ length: 16 }, (_, row) =>
			Array.from({ length: 16 }, (_, column) => (row + column) / 30),
		),
		{
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: xSegments,
			angularSegments: zSegments,
		},
	)

	assert.equal(surface.topVertexCount, (xSegments + 1) * (zSegments + 1))
	assert.equal(surface.indices.length, xSegments * zSegments * 2 * 3)
	const centerColumn = xSegments / 2
	const xCoordinates = []
	for (let row = 0; row <= zSegments; row++) {
		xCoordinates.push(surface.positions[(row * (xSegments + 1) + centerColumn) * 3])
	}
	assert.ok(xCoordinates.every(value => Math.abs(value) < 1e-7))
})

test('carve curve gives mid elevations a crisper depth than linear smoothing', () => {
	const surface = relief.buildCushionReliefSurfaceData(
		[
			[0, 0.5, 1],
			[0, 0.5, 1],
			[0, 0.5, 1],
		],
		{
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: 4,
			angularSegments: 8,
		},
	)

	assert.ok(surface.positions[1] < 5 - 0.25 * 0.54)
})

test('deep terrain samples keep their real separation instead of collapsing into flat lowland islands', () => {
	const sample = relief.createCarvedReliefSampler([
		[0, 0.05, 0.1, 0.5, 1],
		[0, 0.05, 0.1, 0.5, 1],
	])
	const deepest = sample(0, 0.5)
	const next = sample(0.25, 0.5)
	const third = sample(0.5, 0.5)

	assert.ok(next - deepest > 0.04)
	assert.ok(third - next > 0.04)
})

test('full 512 by 512 DEM grids do not exceed JavaScript argument limits', () => {
	const size = 512
	const heightMap = Array.from({ length: size }, (_, row) =>
		Array.from({ length: size }, (_, column) => (row + column) / (size * 2 - 2)),
	)
	assert.doesNotThrow(() =>
		relief.buildCushionReliefSurfaceData(heightMap, {
			cx: 0,
			cz: 0,
			rx: 2,
			rz: 1,
			baseY: 5,
			amplitude: 0.25,
			shape: 'square',
			radialSegments: 2,
			angularSegments: 8,
		}),
	)
})

/** Каждое ребро замкнутого тела должно принадлежать ровно двум треугольникам. */
function edgeUsage(surface) {
	const key = (index) => {
		const q = (value) => Math.round(value / 1e-6)
		const o = index * 3
		return `${q(surface.positions[o])},${q(surface.positions[o + 1])},${q(surface.positions[o + 2])}`
	}
	const counts = new Map()
	for (let i = 0; i < surface.indices.length; i += 3) {
		const a = key(surface.indices[i])
		const b = key(surface.indices[i + 1])
		const c = key(surface.indices[i + 2])
		for (const [p, q] of [
			[a, b],
			[b, c],
			[c, a],
		]) {
			const edge = p < q ? `${p}|${q}` : `${q}|${p}`
			counts.set(edge, (counts.get(edge) ?? 0) + 1)
		}
	}
	let boundary = 0
	let nonManifold = 0
	for (const count of counts.values()) {
		if (count === 1) boundary++
		else if (count !== 2) nonManifold++
	}
	return { boundary, nonManifold }
}

const CLOSING_FRAME = {
	cx: 0,
	cz: 0,
	rx: 2,
	rz: 1,
	baseY: 5,
	amplitude: 0.25,
	heightMode: 'raised',
	shape: 'square',
	radialSegments: 12,
	angularSegments: 16,
}

const CLOSING_HEIGHTMAP = Array.from({ length: 8 }, (_, row) =>
	Array.from({ length: 8 }, (_, column) => (row + column) / 14),
)

test('backingY закрывает шкурку в тело без единой дырки', () => {
	const surface = relief.buildCushionReliefSurfaceData(CLOSING_HEIGHTMAP, {
		...CLOSING_FRAME,
		backingY: 4.5,
	})

	assert.equal(surface.closed, true)
	assert.deepEqual(edgeUsage(surface), { boundary: 0, nonManifold: 0 })
})

test('без backingY поведение прежнее — открытая верхняя шкурка', () => {
	const surface = relief.buildCushionReliefSurfaceData(
		CLOSING_HEIGHTMAP,
		CLOSING_FRAME,
	)

	assert.equal(surface.closed, false)
	assert.equal(surface.positions.length / 3, surface.topVertexCount)
	assert.equal(
		edgeUsage(surface).boundary,
		2 * CLOSING_FRAME.radialSegments + 2 * CLOSING_FRAME.angularSegments,
	)
})

test('замыкание не трогает ни одну вершину видимой верхней шкурки', () => {
	const open = relief.buildCushionReliefSurfaceData(
		CLOSING_HEIGHTMAP,
		CLOSING_FRAME,
	)
	const closed = relief.buildCushionReliefSurfaceData(CLOSING_HEIGHTMAP, {
		...CLOSING_FRAME,
		backingY: 4.5,
	})

	assert.equal(closed.topVertexCount, open.topVertexCount)
	for (let i = 0; i < open.positions.length; i++) {
		assert.equal(closed.positions[i], open.positions[i])
	}
})

test('дно опускается ниже шкурки, даже если backingY задан выше неё', () => {
	const surface = relief.buildCushionReliefSurfaceData(CLOSING_HEIGHTMAP, {
		...CLOSING_FRAME,
		backingY: 99,
	})

	let minTopY = Infinity
	for (let vertex = 0; vertex < surface.topVertexCount; vertex++) {
		minTopY = Math.min(minTopY, surface.positions[vertex * 3 + 1])
	}

	// Первое кольцо замыкающих вершин — дубли периметра на уровне шкурки,
	// ниже опускаются только дно и его центр.
	const perimeter = 2 * CLOSING_FRAME.radialSegments + 2 * CLOSING_FRAME.angularSegments
	const floorStart = surface.topVertexCount + perimeter
	assert.equal(surface.positions.length / 3, floorStart + perimeter + 1)

	for (let vertex = floorStart; vertex < surface.positions.length / 3; vertex++) {
		const y = surface.positions[vertex * 3 + 1]
		assert.ok(y < minTopY, `вершина дна ${vertex} на ${y} не ниже ${minTopY}`)
	}
	assert.deepEqual(edgeUsage(surface), { boundary: 0, nonManifold: 0 })
})
