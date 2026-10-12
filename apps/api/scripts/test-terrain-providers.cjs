const test = require('node:test')
const assert = require('node:assert/strict')
const terrain = require('@favplace/terrain')
const { TerrainService } = require('../dist/terrain/terrain.service')

test('provider overrides are rejected in production and invalid providers cannot trigger downloads', async () => {
	const env = process.env.NODE_ENV, original = terrain.fetchHeightMap
	let downloads = 0
	terrain.fetchHeightMap = async () => { downloads++; throw new Error('Unexpected download') }
	try {
		const service = new TerrainService()
		process.env.NODE_ENV = 'production'
		await assert.rejects(service.getHeightMap(35, 138, 500, 64, 0, 0, 'mapbox'), error => error.getStatus() === 404)
		process.env.NODE_ENV = 'development'
		await assert.rejects(service.getHeightMap(35, 138, 500, 64, 0, 0, 'invalid'), error => error.getStatus() === 400)
		assert.equal(downloads, 0)
	} finally {
		terrain.fetchHeightMap = original
		if (env === undefined) delete process.env.NODE_ENV
		else process.env.NODE_ENV = env
	}
})
