import assert from 'node:assert/strict'
import test from 'node:test'

const terrain = await import('../src/tiles.ts').catch(() => ({}))

test('Terrarium uses zoom 15 for small-radius terrain crops', () => {
	assert.equal(typeof terrain.getZoomForRadius, 'function')
	assert.equal(terrain.getZoomForRadius(100, 36, 'terrarium'), 15)
	assert.equal(terrain.getZoomForRadius(500, 36, 'terrarium'), 15)
	assert.equal(terrain.getZoomForRadius(1_000, 36, 'terrarium'), 14)
})
