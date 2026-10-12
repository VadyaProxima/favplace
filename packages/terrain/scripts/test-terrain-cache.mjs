import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const { fetchTile, decodeDemTile } = require('../dist/tiles.js')
const { fetchHeightMap } = require('../dist/heightmap.js')

test('terrain tile downloads are shared, decoded once and reused by different crop resolutions', async () => {
	const originalFetch = globalThis.fetch
	const png = new PNG({ width: 256, height: 256 })
	for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
		const i = (y * 256 + x) * 4
		const elevation = 1000 + x + y
		png.data[i] = Math.floor((elevation + 32768) / 256)
		png.data[i + 1] = (elevation + 32768) % 256
		png.data[i + 2] = 0; png.data[i + 3] = 255
	}
	const bytes = PNG.sync.write(png)
	let calls = 0
	globalThis.fetch = async () => {
		calls++
		await new Promise(resolve => setTimeout(resolve, 10))
		return new Response(bytes)
	}
	try {
		const tile = { x: 12345, y: 23456, z: 15 }
		const [a, b] = await Promise.all([fetchTile(tile, 'terrarium'), fetchTile(tile, 'terrarium')])
		assert.equal(calls, 1)
		assert.equal(a, b)
		assert.equal(decodeDemTile(a, 'terrarium'), decodeDemTile(b, 'terrarium'))
		const small = await fetchHeightMap(10.123, 20.123, 100, { resolution: 64 })
		const loaded = calls
		const fine = await fetchHeightMap(10.123, 20.123, 100, { resolution: 1024 })
		assert.equal(calls, loaded, 'changing resolution must reuse decoded DEM tiles')
		assert.equal(small.width, 64); assert.equal(small.data.length, 64)
		assert.equal(fine.width, 1024); assert.equal(fine.data.length, 1024)
		assert.ok(fine.maxElevation > fine.minElevation)
		assert.equal(await fetchHeightMap(10.123, 20.123, 100, { resolution: 64 }), small)
		assert.equal(small.minElevation, fine.minElevation)
		assert.equal(small.maxElevation, fine.maxElevation)
		globalThis.fetch = async () => { calls++; return new Response(null, { status: 404 }) }
		const count = calls
		await assert.rejects(fetchTile({ x: 12346, y: 23457, z: 15 }, 'terrarium'), /HTTP 404/)
		assert.equal(calls, count + 1, 'a missing tile should fall back without six pointless retries')
	} finally { globalThis.fetch = originalFetch }
})

test('parallel Mapbox and Terrarium crops at identical coordinates keep separate data and caches', async () => {
	const originalFetch = globalThis.fetch
	const originalToken = process.env.MAPBOX_ACCESS_TOKEN
	const defaultProvider = process.env.TERRAIN_DEM_PROVIDER
	process.env.MAPBOX_ACCESS_TOKEN = 'test-only-token'
	const bytes = elevation => {
		const png = new PNG({ width: 256, height: 256 })
		for (let i = 0; i < png.data.length; i += 4) {
			if (elevation === 100) {
				const value = (elevation + 10000) * 10
				png.data[i] = value >> 16; png.data[i + 1] = (value >> 8) & 255; png.data[i + 2] = value & 255
			} else {
				png.data[i] = Math.floor((elevation + 32768) / 256)
				png.data[i + 1] = (elevation + 32768) % 256; png.data[i + 2] = 0
			}
			png.data[i + 3] = 255
		}
		return PNG.sync.write(png)
	}
	const mapboxBytes = bytes(100), terrariumBytes = bytes(1000)
	const calls = []
	globalThis.fetch = async url => {
		const mapbox = new URL(url).hostname === 'api.mapbox.com'
		calls.push(mapbox ? 'mapbox' : 'terrarium')
		await new Promise(resolve => setTimeout(resolve, 5))
		return new Response(mapbox ? mapboxBytes : terrariumBytes)
	}
	try {
		const [mapbox, terrarium] = await Promise.all(['mapbox', 'terrarium'].map(provider =>
			fetchHeightMap(11.123, 21.123, 100, { resolution: 64, provider })))
		assert.equal(mapbox.demSource, 'mapbox'); assert.equal(terrarium.demSource, 'terrarium')
		assert.ok(Math.abs(mapbox.minElevation - 100) < 1e-6)
		assert.ok(Math.abs(mapbox.maxElevation - 100) < 1e-6)
		assert.ok(Math.abs(terrarium.minElevation - 1000) < 1e-6)
		assert.ok(Math.abs(terrarium.maxElevation - 1000) < 1e-6)
		assert.ok(calls.includes('mapbox') && calls.includes('terrarium'))
		const loaded = calls.length
		assert.equal(await fetchHeightMap(11.123, 21.123, 100, { resolution: 64, provider: 'mapbox' }), mapbox)
		assert.equal(await fetchHeightMap(11.123, 21.123, 100, { resolution: 64, provider: 'terrarium' }), terrarium)
		assert.equal(calls.length, loaded)
		assert.equal(process.env.TERRAIN_DEM_PROVIDER, defaultProvider)
	} finally {
		globalThis.fetch = originalFetch
		if (originalToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN
		else process.env.MAPBOX_ACCESS_TOKEN = originalToken
	}
})
