import assert from 'node:assert/strict'
import test from 'node:test'
import { LiveTerrainAnalysis, terrainFrameContains } from '../src/lib/liveTerrainAnalysis.ts'
import { readTerrainResponse } from '../src/lib/referenceTerrainRequests.ts'

const initial = { lat: 35.3628, lng: 138.7307, radiusKm: .5, bearing: 0, interacting: true }
const settle = () => new Promise(resolve => setImmediate(resolve))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
function rig() {
	const requests = [], views = [], results = [], busy = [], errors = []
	const analysis = new LiveTerrainAnalysis({
		onView: view => views.push(view),
		onFrames: (fine, coarse, view) => results.push({ fine, coarse, view }),
		onBusy: value => busy.push(value),
		onError: error => errors.push(error),
		fetchFrame: (stage, signal) => new Promise((resolve, reject) => requests.push({ stage, signal, resolve, reject })),
	})
	const resolve = request => request.resolve({
		frame: { lat: request.stage.lat, lng: request.stage.lng, radiusKm: request.stage.radiusMeters / 1000, bearing: request.stage.bearing },
		size: request.stage.resolution, data: [], minElev: 0, maxElev: 1000, final: request.stage.final,
	})
	return { analysis, requests, views, results, busy, errors, resolve }
}

test('a preview appears without waiting for the broad context', async () => {
	const r = rig(); r.analysis.update(initial)
	assert.equal(r.requests.length, 2)
	r.resolve(r.requests.find(request => request.stage.resolution === 512)); await settle()
	assert.equal(r.results.length, 1)
	assert.equal(r.results[0].coarse, null)
	assert.equal(r.results[0].fine.final, false)
	r.analysis.dispose()
})

test('continuous motion uses cached terrain and keeps useful downloads alive', async () => {
	const r = rig(); r.analysis.update(initial)
	for (let i = 1; i <= 20; i++) r.analysis.update({ ...initial, lng: initial.lng + i * .0001 })
	assert.equal(r.requests.length, 2)
	assert.ok(r.requests.every(request => !request.signal.aborted))
	assert.equal(r.views.length, 21, 'local view must move before any network response')
	r.requests.forEach(r.resolve); await settle()
	const source = r.results.at(-1).fine
	for (let i = 21; i <= 40; i++) r.analysis.update({ ...initial, lng: initial.lng + i * .0001 })
	await wait(220)
	assert.equal(r.requests.length, 2, 'dragging must not request a new crop for every coordinate')
	assert.equal(r.results.at(-1).fine, source)
	assert.equal(r.results.at(-1).view.lng, initial.lng + .004)
	r.analysis.dispose()
})

test('the exact crop is requested after stopping and is cancelled when movement resumes', async () => {
	const r = rig(); r.analysis.update(initial); r.requests.forEach(r.resolve); await settle()
	const stopped = { ...initial, lng: initial.lng + .001, interacting: false }
	r.analysis.update(stopped); await wait(220)
	assert.equal(r.requests.length, 3)
	const exact = r.requests[2]
	assert.equal(exact.stage.resolution, 1024)
	assert.equal(exact.stage.radiusMeters, 500)
	assert.equal(exact.stage.lng, stopped.lng)
	r.analysis.update({ ...stopped, lng: stopped.lng + .001, interacting: true })
	assert.equal(exact.signal.aborted, true)
	r.resolve(exact); await settle()
	assert.ok(r.results.every(result => !result.fine.final), 'an old final response must not replace the current map view')
	r.analysis.dispose()
})

test('a distant preset replaces obsolete downloads and ignores their late responses', async () => {
	const r = rig(); r.analysis.update(initial)
	const old = [...r.requests]
	const next = { ...initial, lat: 43.3499, lng: 42.4453, interacting: false }
	r.analysis.update(next)
	assert.ok(old.every(request => request.signal.aborted))
	old.forEach(r.resolve); await settle()
	assert.equal(r.results.length, 0)
	r.requests.slice(2).forEach(r.resolve); await settle()
	assert.equal(r.results.at(-1).view.lat, next.lat)
	r.analysis.dispose()
})

test('disposing aborts requests and suppresses late notifications', async () => {
	const r = rig(); r.analysis.update({ ...initial, interacting: false }); r.analysis.dispose()
	const count = r.busy.length
	r.requests.forEach(r.resolve); await wait(220)
	assert.equal(r.results.length, 0); assert.equal(r.busy.length, count); assert.equal(r.requests.length, 2)
	assert.ok(r.requests.every(request => request.signal.aborted))
})

test('a failed crop can be retried at the same coordinates', async () => {
	const r = rig(); r.analysis.update(initial)
	r.requests[0].reject(new Error('offline')); await settle()
	r.analysis.update(initial)
	assert.equal(r.requests.length, 3)
	r.analysis.dispose()
})

test('a new preset never reuses broad context from another mountain', async () => {
	const r = rig(); r.analysis.update(initial); r.requests.forEach(r.resolve); await settle()
	r.analysis.update({ ...initial, lat: 43.3499, lng: 42.4453, interacting: false })
	r.resolve(r.requests.find(request => request.stage.lat === 43.3499 && request.stage.resolution === 512)); await settle()
	assert.equal(r.results.at(-1).fine.frame.lat, 43.3499)
	assert.equal(r.results.at(-1).coarse, null)
	r.analysis.dispose()
})

test('repeated final crops retain the wide region for subsequent movement', async () => {
	const r = rig(); r.analysis.update(initial); r.requests.forEach(r.resolve); await settle()
	for (let i = 1; i <= 4; i++) {
		r.analysis.update({ ...initial, lng: initial.lng + i * .0001, interacting: false }); await wait(220)
		r.resolve(r.requests.at(-1)); await settle()
	}
	r.analysis.update({ ...initial, lng: initial.lng + .0005 })
	assert.equal(r.requests.filter(request => request.stage.resolution === 512).length, 1)
	r.analysis.dispose()
})

test('coverage checks rotated corners, zoom and geographic displacement', () => {
	assert.equal(terrainFrameContains(initial, initial), true)
	assert.equal(terrainFrameContains(initial, { ...initial, bearing: 45 }), false)
	assert.equal(terrainFrameContains({ ...initial, radiusKm: 1.5 }, { ...initial, bearing: 45 }, .2), true)
	assert.equal(terrainFrameContains(initial, { ...initial, lng: initial.lng + .02 }), false)
	assert.equal(terrainFrameContains(initial, { ...initial, radiusKm: 1 }), false)
})

test('binary heights preserve DEM precision and reject truncated responses', async () => {
	const width = 64, data = Buffer.alloc(width * width * 4)
	for (let i = 0; i < width * width; i++) data.writeFloatLE(i / (width * width), i * 4)
	const headers = { 'content-type': 'application/octet-stream', 'X-Terrain-Metadata': JSON.stringify({ width, height: width, frame: initial, metadata: { minElevation: 0, maxElevation: 5000 } }) }
	const decoded = await readTerrainResponse(new Response(data, { headers }))
	assert.equal(decoded.data[63][63], 4095 / 4096)
	assert.equal(decoded.data.length, 64)
	await assert.rejects(readTerrainResponse(new Response(data.subarray(0, 12), { headers })), /Incomplete/)
	const legacy = { data: [[.5]], width: 1, height: 1 }
	assert.deepEqual(await readTerrainResponse(Response.json(legacy)), legacy)
})
