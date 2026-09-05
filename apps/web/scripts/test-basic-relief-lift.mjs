import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { buildCushionReliefSurfaceData } from '../src/lib/basicReliefSurface.ts'

test('raised relief places DEM zero on the ring datum and grows upward', () => {
	const heightMap = [
		[0, 0.5, 1],
		[0, 0.5, 1],
		[0, 0.5, 1],
	]
	const surface = buildCushionReliefSurfaceData(heightMap, {
		cx: 0,
		cz: 0,
		rx: 2,
		rz: 2,
		baseY: 5,
		amplitude: 2,
		heightMode: 'raised',
		shape: 'square',
		radialSegments: 2,
		angularSegments: 2,
	})
	const rowSize = 3
	const leftY = ((1 * rowSize + 0) * 3) + 1
	const rightY = ((1 * rowSize + 2) * 3) + 1

	assert.ok(Math.abs(surface.positions[leftY] - 5) < 1e-6)
	assert.ok(Math.abs(surface.positions[rightY] - 7) < 1e-6)
})

test('raised relief returns smoothly to ring zero at every outer edge', () => {
	const heightMap = Array.from({ length: 5 }, () => Array(5).fill(1))
	heightMap[0][0] = 0
	const surface = buildCushionReliefSurfaceData(heightMap, {
		cx: 0,
		cz: 0,
		rx: 2,
		rz: 2,
		baseY: 5,
		amplitude: 1,
		heightMode: 'raised',
		boundarySeatStart: 0.75,
		shape: 'square',
		radialSegments: 4,
		angularSegments: 4,
	})
	const rowSize = 5
	const centerY = ((2 * rowSize + 2) * 3) + 1
	const outerVertices = [
		0,
		4,
		4 * rowSize,
		4 * rowSize + 4,
		2,
		2 * rowSize,
		2 * rowSize + 4,
		4 * rowSize + 2,
	]

	assert.ok(Math.abs(surface.positions[centerY] - 6) < 1e-6)
	for (const vertex of outerVertices) {
		assert.ok(Math.abs(surface.positions[vertex * 3 + 1] - 5) < 1e-6)
	}
})

test('basic ring preparation no longer deforms the source ring geometry', () => {
	const source = fs.readFileSync(
		new URL('../src/lib/basicRingFromGlb.ts', import.meta.url),
		'utf8',
	)
	assert.doesNotMatch(source, /function carveTableFace|carveTableFace\s*\(/)
})
