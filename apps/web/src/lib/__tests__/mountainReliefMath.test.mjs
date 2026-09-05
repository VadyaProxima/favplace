import assert from 'node:assert/strict'
import test from 'node:test'

import {
	buildMaskedHeightField,
	buildReliefSurfaceData,
	reliefEdgeMask,
} from '../mountainReliefMath.ts'

test('relief edge mask is full at center and zero at every socket edge', () => {
	assert.equal(reliefEdgeMask(0, 0, 0.18), 1)
	assert.equal(reliefEdgeMask(1, 0, 0.18), 0)
	assert.equal(reliefEdgeMask(-1, 0, 0.18), 0)
	assert.equal(reliefEdgeMask(0, 1, 0.18), 0)
	assert.equal(reliefEdgeMask(0, -1, 0.18), 0)
})

test('masked height field has a zero perimeter for an arbitrary heightmap', () => {
	const rows = 9
	const cols = 11
	const field = buildMaskedHeightField(
		[
			[0, 1],
			[1, 0],
		],
		rows,
		cols,
		0.18,
	)

	for (let x = 0; x < cols; x++) {
		assert.equal(field[x], 0)
		assert.equal(field[(rows - 1) * cols + x], 0)
	}
	for (let y = 0; y < rows; y++) {
		assert.equal(field[y * cols], 0)
		assert.equal(field[y * cols + cols - 1], 0)
	}
})

test('relief surface keeps the socket plane at its perimeter and lifts its center', () => {
	const rows = 5
	const cols = 7
	const surface = buildReliefSurfaceData(
		[
			[1, 1],
			[1, 1],
		],
		{
			length: 2,
			width: 1,
			baseY: 3,
			amplitude: 0.5,
			rows,
			cols,
			edgeFade: 0.18,
			power: 4,
		},
	)

	const yAt = (row, col) => surface.positions[(row * cols + col) * 3 + 1]
	assert.equal(yAt(0, 3), 3)
	assert.equal(yAt(2, 0), 3)
	assert.equal(yAt(2, 3), 3.5)
	assert.equal(surface.indices.length, (rows - 1) * (cols - 1) * 6)
})
