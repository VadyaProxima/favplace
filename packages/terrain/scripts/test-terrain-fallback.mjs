import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const { fetchHeightMap } = require('../dist/heightmap.js')
const { getDemProvider } = require('../dist/tiles.js')

function tile(provider, elevation) {
	const png = new PNG({ width: 256, height: 256 })
	const value = provider === 'mapbox' ? (elevation + 10000) * 10 : (elevation + 32768) * 256
	for (let i = 0; i < png.data.length; i += 4) {
		png.data[i] = value >> 16; png.data[i + 1] = (value >> 8) & 255
		png.data[i + 2] = value & 255; png.data[i + 3] = 255
	}
	return PNG.sync.write(png)
}
const primary = tile('mapbox', 100), backup = tile('terrarium', 1000)

test('automatic Mapbox selection falls back without mixing tiles, cools down, and recovers without poisoned caches', async () => {
	const original = { fetch, now: Date.now, timeout: AbortSignal.timeout, token: process.env.MAPBOX_ACCESS_TOKEN, provider: process.env.TERRAIN_DEM_PROVIDER }
	let clock = original.now(), calls = [], mode = 'ok', missingTile = false
	Date.now = () => clock
	delete process.env.TERRAIN_DEM_PROVIDER
	process.env.MAPBOX_ACCESS_TOKEN = 'test-only-token'
	const options = { resolution: 64, bearing: 57, zoomOffset: 1 }
	globalThis.fetch = async (url, init) => {
		const provider = new URL(url).hostname === 'api.mapbox.com' ? 'mapbox' : 'terrarium'
		calls.push({ provider, url: new URL(url).pathname })
		if (provider === 'terrarium') return new Response(backup)
		if (mode === 'network') throw new TypeError('fetch failed')
		if (mode === 'timeout') return new Promise((_, reject) => {
			init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
		})
		if (mode === 'slow-crop') await new Promise(resolve => setTimeout(resolve, 25))
		if (mode === 'corrupt') return new Response('not a png')
		if (mode === 'partial' && !missingTile) { missingTile = true; return new Response(null, { status: 403 }) }
		if (typeof mode === 'number') return new Response(null, { status: mode })
		return new Response(primary)
	}
	try {
		assert.equal(getDemProvider(), 'mapbox')
		process.env.TERRAIN_DEM_PROVIDER = 'terrarium'
		assert.equal(getDemProvider(), 'terrarium')
		delete process.env.TERRAIN_DEM_PROVIDER
		for (const [index, failure] of [401, 403, 429, 503, 'network', 'corrupt', 'missing-token', 'timeout', 'partial', 'slow-crop'].entries()) {
			clock += 61_000; calls = []; mode = failure; missingTile = false
			if (failure === 'missing-token') delete process.env.MAPBOX_ACCESS_TOKEN
			else process.env.MAPBOX_ACCESS_TOKEN = 'test-only-token'
			if (failure === 'timeout') AbortSignal.timeout = ms => original.timeout.call(AbortSignal, ms === 6000 ? 15 : ms === 8000 ? 30 : ms)
			if (failure === 'slow-crop') AbortSignal.timeout = ms => original.timeout.call(AbortSignal, ms === 6000 ? 100 : ms === 8000 ? 35 : ms)
			const lat = 12 + index, lng = 22 + index, radius = ['partial', 'slow-crop'].includes(failure) ? 1500 : 100
			// Keep a referenced timer alive for Node's unref'ed AbortSignal timeout in this mock.
			const keepAlive = setTimeout(() => {}, 1000)
			let result
			try { result = await fetchHeightMap(lat, lng, radius, options) }
			finally { clearTimeout(keepAlive); AbortSignal.timeout = original.timeout }
			assert.equal(result.demSource, 'terrarium', String(failure))
			assert.equal(result.width, 64)
			assert.ok(Math.abs(result.minElevation - 1000) < 1e-6, 'the whole crop must use the backup, including partially loaded tiles')
			assert.ok(Math.abs(result.maxElevation - 1000) < 1e-6)
			assert.equal(result, await fetchHeightMap(lat, lng, radius, { ...options, provider: 'terrarium' }), 'fallback must preserve coordinates, radius, bearing and zoom')
			const count = calls.filter(c => c.provider === 'mapbox').length
			if (failure === 'slow-crop') assert.ok(count <= 8, 'the crop deadline must stop queuing more Mapbox batches')
			mode = 'ok'; process.env.MAPBOX_ACCESS_TOKEN = 'test-only-token'
			const cooldown = await fetchHeightMap(lat + .04, lng, radius, options)
			assert.equal(cooldown.demSource, 'terrarium')
			assert.equal(calls.filter(c => c.provider === 'mapbox').length, count, 'cooldown must prevent repeated failed Mapbox downloads')
			if (typeof failure === 'number') assert.ok(calls.filter(c => c.provider === 'mapbox').every(c => c.url.includes('/15/') || failure === 'partial'), 'auth/rate/server failures must not retry lower zooms')
			if (failure === 'timeout') await new Promise(resolve => setTimeout(resolve, 40))
			if (failure === 'slow-crop') await new Promise(resolve => setTimeout(resolve, 75))
			clock += 61_000
			const recovered = await fetchHeightMap(lat, lng, radius, options)
			assert.equal(recovered.demSource, 'mapbox', `next request after ${failure} cooldown retries the primary`)
			assert.ok(Math.abs(recovered.minElevation - 100) < 1e-6)
			assert.equal(await fetchHeightMap(lat, lng, radius, options), recovered)
		}
		clock += 61_000; mode = 401
		await assert.rejects(fetchHeightMap(28, 38, 100, { ...options, provider: 'mapbox' }), /HTTP 401/, 'forced development comparison stays strict')
		globalThis.fetch = async () => new Response(null, { status: 404 })
		await assert.rejects(fetchHeightMap(29, 39, 100, options), /HTTP 404/, 'failure of both providers remains an error')
	} finally {
		globalThis.fetch = original.fetch; Date.now = original.now; AbortSignal.timeout = original.timeout
		for (const [key, value] of [['MAPBOX_ACCESS_TOKEN', original.token], ['TERRAIN_DEM_PROVIDER', original.provider]]) {
			if (value === undefined) delete process.env[key]; else process.env[key] = value
		}
	}
})
