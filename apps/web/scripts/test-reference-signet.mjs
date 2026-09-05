import assert from 'node:assert/strict'
import test from 'node:test'

import * as terrain from '../src/lib/referenceSignetTerrain.ts'
import * as ring from '../src/lib/referenceMountainSignet.ts'
const reliefSurface = await import(
	'../src/lib/interactiveMountainReliefSurface.ts'
).catch(() => ({}))
import * as requestLifecycle from '../src/lib/referenceTerrainRequests.ts'
import * as mountainStl from '../src/lib/referenceMountainStl.ts'
import { useAppStore } from '../src/store/useAppStore.ts'
import * as terrainRequest from '../../../packages/terrain/src/referenceFrame.ts'

function constantFrame(value, minElev, maxElev, radiusKm = 1) {
	return {
		data: [
			[value, value],
			[value, value],
		],
		size: 2,
		minElev,
		maxElev,
		frame: { lat: 0, lng: 0, radiusKm, bearing: 0 },
		final: true,
	}
}

function maximum(values) {
	let result = -Infinity
	for (const value of values) result = Math.max(result, value)
	return result
}

test('relief slider endpoints produce the reference physical height range', () => {
	assert.equal(terrain.reliefMillimeters(0), 0.3)
	assert.equal(terrain.reliefMillimeters(1), 3)
	assert.equal(terrain.reliefMillimeters(-4), 0.3)
	assert.equal(terrain.reliefMillimeters(9), 3)
})

test('smooth DEM interpolation preserves the hand-calculated midpoint', () => {
	const frame = {
		...constantFrame(0, 100, 200),
		data: [
			[0, 1],
			[1, 0],
		],
	}
	assert.equal(terrain.sampleFrameElevation(frame, 0.5, 0.5), 150)
})

test('fine terrain remains fully authoritative on its valid boundary', () => {
	const fine = constantFrame(1, 1000, 1200, 1)
	const coarse = constantFrame(1, 0, 800, 8)
	const samples = terrain.sampleFramedTerrain(
		fine,
		coarse,
		fine.frame,
		[[1, 0.5]],
		0,
	)
	assert.equal(samples[0], 1200)
})

test('coarse terrain fills a view point outside fine coverage', () => {
	const fine = constantFrame(1, 1000, 1200, 1)
	const coarse = constantFrame(1, 0, 800, 8)
	const view = { ...fine.frame, radiusKm: 1.1 }
	const samples = terrain.sampleFramedTerrain(
		fine,
		coarse,
		view,
		[[1, 0.5]],
		0,
	)
	assert.equal(samples[0], 800)
})

test('bearing rotates a crop in geographic space without changing its radius', () => {
	const north = terrainRequest.rotatedCropCoordinate(0, 0, 1000, 0, 1, 0)
	const east = terrainRequest.rotatedCropCoordinate(0, 0, 1000, 90, 1, 0)
	assert.ok(north.lng > 0)
	assert.ok(Math.abs(north.lat) < 1e-10)
	assert.ok(Math.abs(east.lng) < 1e-10)
	assert.ok(east.lat < 0)
	assert.ok(Math.abs(terrainRequest.cropEnvelopeScale(45) - Math.SQRT2) < 1e-12)
})

test('terrain request frames preserve the selected coordinates and x8 context', () => {
	const fine = terrainRequest.createTerrainGeoFrame(34.28321, 67.43032, 1400, -25)
	const coarse = terrainRequest.contextTerrainGeoFrame(fine, 8)
	assert.deepEqual(
		{ lat: coarse.lat, lng: coarse.lng, bearing: coarse.bearing },
		{ lat: fine.lat, lng: fine.lng, bearing: fine.bearing },
	)
	assert.equal(coarse.radiusKm, fine.radiusKm * 8)
	assert.equal(terrainRequest.clampZoomOffset(-99), -6)
	assert.equal(terrainRequest.clampZoomOffset(99), 2)
})

test('progressive request plan starts light and refines through 256, 512, and exact 1024 stages', () => {
	const plan = requestLifecycle.createTerrainRequestPlan({
		lat: 34.28321,
		lng: 67.43032,
		radiusMeters: 1400,
		bearing: -25,
	})
	assert.equal(plan.coarse.radiusMeters, 11200)
	assert.equal(plan.coarse.resolution, 256)
	assert.equal(plan.coarse.zoomOffset, -2)
	assert.deepEqual(
		plan.fine.map(stage => [
			stage.resolution,
			stage.zoomOffset,
			stage.final,
			stage.delayMs,
		]),
		[
			[256, -4, false, 0],
			[512, -2, false, 80],
			[1024, 0, true, 650],
		],
	)
})

test('stale refinement cancels while waiting for its idle delay', async () => {
	const controller = new AbortController()
	const waiting = requestLifecycle.waitForTerrainStageDelay(500, controller.signal)
	controller.abort()
	await assert.rejects(waiting, error => error?.name === 'AbortError')
})

test('request gate rejects responses from a replaced generation', () => {
	const gate = requestLifecycle.createLatestRequestGate()
	const first = gate.begin()
	const second = gate.begin()
	assert.equal(gate.isCurrent(first), false)
	assert.equal(gate.isCurrent(second), true)
})

test('mountain controls keep reference presets and normalized relief state', () => {
	const state = useAppStore.getState()
	assert.equal(state.ringWeight, 'classic')
	assert.equal(state.bandProfile, 'classic')
	assert.equal(state.shoulderStyle, 'classic')
	assert.equal(state.terrainBearing, 0)
	assert.equal(state.reliefScale, 0.5)
	state.setReliefScale(1)
	assert.equal(useAppStore.getState().reliefHeight, 3)
	state.setReliefScale(0.5)
})

test('mountain signet is one closed periodic mesh', () => {
	const model = ring.buildMountainSignet({
		ringDiameter: 17,
		resolution: 0.2,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const report = ring.watertightReport(model.geometry)
	assert.equal(report.boundaryEdges, 0)
	assert.equal(report.nonManifoldEdges, 0)
	assert.equal(model.geometry.groups.length, 0)
	assert.equal(model.publicProps.innerDiameter, 17)
})

test('viewer quality selects the same reference preview and exact resolutions', () => {
	assert.equal(ring.mountainResolutionForQuality('preview'), 0.2)
	assert.equal(ring.mountainResolutionForQuality('exact'), 0.05)
})

test('interactive mountain preview reuses one lightweight topology across terrain updates', () => {
	const model = ring.createInteractiveMountainSignet({
		ringDiameter: 17,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const geometry = model.geometry
	const first = constantFrame(0, 100, 300)
	const second = {
		...constantFrame(0, 100, 300),
		data: [
			[0, 0.25],
			[0.75, 1],
		],
	}
	for (const fine of [first, second]) {
		const updated = ring.updateInteractiveMountainSignet(model, {
			fine,
			coarse: null,
			view: fine.frame,
			relief: 0.5,
			smoothing: 0,
		})
		assert.equal(updated, model)
		assert.equal(updated.geometry, geometry)
	}
	assert.equal(
		model.geometry.getAttribute('position').count,
		ring.buildMountainSignet({
			ringDiameter: 17,
			resolution: 0.2,
			weight: 'classic',
			bandProfile: 'classic',
			shoulderStyle: 'classic',
		}).geometry.getAttribute('position').count,
	)
})

test('interactive relief concentrates the high-detail budget on a 257 by 257 face grid', () => {
	assert.equal(typeof reliefSurface.interactiveReliefSegments, 'function')
	assert.equal(typeof reliefSurface.createInteractiveReliefSurface, 'function')
	assert.deepEqual(
		['low', 'medium', 'high'].map(reliefSurface.interactiveReliefSegments),
		[64, 128, 256],
	)
	const host = ring.createInteractiveMountainSignet({
		ringDiameter: 17,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const surface = reliefSurface.createInteractiveReliefSurface(host, 'high')
	assert.equal(surface.gridSegments, 256)
	assert.equal(surface.geometry.getAttribute('position').count, 257 * 257)
	assert.ok(
		surface.geometry.getAttribute('position').count >
			host.faceVertexIndices.length * 18,
	)
})

test('interactive relief reuses its dense topology while terrain values change', () => {
	assert.equal(typeof reliefSurface.createInteractiveReliefSurface, 'function')
	assert.equal(typeof reliefSurface.updateInteractiveReliefSurface, 'function')
	const host = ring.createInteractiveMountainSignet({
		ringDiameter: 17,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const surface = reliefSurface.createInteractiveReliefSurface(host, 'high')
	const geometry = surface.geometry
	const position = geometry.getAttribute('position')
	const index = geometry.getIndex()
	const first = constantFrame(0, 100, 300)
	const second = {
		...constantFrame(0, 100, 300),
		data: [
			[0, 0.2],
			[0.7, 1],
		],
	}
	const before = position.array.slice()
	for (const fine of [first, second]) {
		ring.updateInteractiveMountainSignet(host, {
			fine,
			coarse: null,
			view: fine.frame,
			relief: 0.5,
			smoothing: 0,
		})
		const updated = reliefSurface.updateInteractiveReliefSurface(surface, host, {
			fine,
			coarse: null,
			view: fine.frame,
			relief: 0.5,
			smoothing: 0,
		})
		assert.equal(updated, surface)
		assert.equal(updated.geometry, geometry)
		assert.equal(updated.geometry.getAttribute('position'), position)
		assert.equal(updated.geometry.getIndex(), index)
	}
	assert.notDeepEqual(position.array, before)
})

test('dense relief replaces the covered host triangles and binds every boundary vertex', () => {
	assert.equal(typeof reliefSurface.createInteractiveReliefHostGeometry, 'function')
	const host = ring.createInteractiveMountainSignet({
		ringDiameter: 17,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const fine = {
		...constantFrame(0, 100, 300),
		data: [
			[0, 0.25],
			[0.75, 1],
		],
	}
	ring.updateInteractiveMountainSignet(host, {
		fine,
		coarse: null,
		view: fine.frame,
		relief: 0.5,
		smoothing: 0,
	})
	const surface = reliefSurface.createInteractiveReliefSurface(host, 'high')
	reliefSurface.updateInteractiveReliefSurface(surface, host, {
		fine,
		coarse: null,
		view: fine.frame,
		relief: 0.5,
		smoothing: 0,
	})
	const renderedHost = reliefSurface.createInteractiveReliefHostGeometry(host)
	const sourceTriangles = host.geometry.getIndex().count / 3
	assert.equal(
		renderedHost.geometry.getIndex().count / 3,
		sourceTriangles - renderedHost.removedTriangleCount,
	)
	assert.equal(
		renderedHost.removedTriangleCount,
		(host.faceRadialIndices.length - 1) *
			(host.sectionSurfaceIndices.length - 1) *
			2,
	)
	assert.equal(surface.boundaryBindings.length, surface.gridSegments * 4)
	const hostPositions = host.geometry.getAttribute('position').array
	const surfacePositions = surface.geometry.getAttribute('position').array
	const hostNormals = host.geometry.getAttribute('normal').array
	const surfaceNormals = surface.geometry.getAttribute('normal').array
	let maximumGap = 0
	let maximumNormalGap = 0
	for (const binding of surface.boundaryBindings) {
		for (let axis = 0; axis < 3; axis++) {
			const expected =
				hostPositions[binding.a * 3 + axis] * binding.wa +
				hostPositions[binding.b * 3 + axis] * binding.wb +
				hostPositions[binding.c * 3 + axis] * binding.wc +
				hostPositions[binding.d * 3 + axis] * binding.wd
			maximumGap = Math.max(
				maximumGap,
				Math.abs(surfacePositions[binding.surfaceVertex * 3 + axis] - expected),
			)
		}
		const expectedNormal = [0, 0, 0]
		for (let axis = 0; axis < 3; axis++) {
			expectedNormal[axis] =
				hostNormals[binding.a * 3 + axis] * binding.wa +
				hostNormals[binding.b * 3 + axis] * binding.wb +
				hostNormals[binding.c * 3 + axis] * binding.wc +
				hostNormals[binding.d * 3 + axis] * binding.wd
		}
		const normalLength = Math.hypot(...expectedNormal) || 1
		for (let axis = 0; axis < 3; axis++) {
			maximumNormalGap = Math.max(
				maximumNormalGap,
				Math.abs(
					surfaceNormals[binding.surfaceVertex * 3 + axis] -
						expectedNormal[axis] / normalLength,
				),
			)
		}
	}
	assert.ok(maximumGap < 1e-5)
	assert.ok(maximumNormalGap < 1e-5)
	assert.deepEqual(ring.watertightReport(surface.geometry), {
		boundaryEdges: surface.gridSegments * 4,
		nonManifoldEdges: 0,
	})
})

test('exact ring keeps the same dimensions with materially denser geometry', () => {
	const options = {
		ringDiameter: 17,
		weight: /** @type {const} */ ('classic'),
		bandProfile: /** @type {const} */ ('classic'),
		shoulderStyle: /** @type {const} */ ('classic'),
	}
	const preview = ring.buildMountainSignet({ ...options, resolution: 0.2 })
	const exact = ring.buildMountainSignet({ ...options, resolution: 0.05 })
	assert.equal(exact.publicProps.innerDiameter, preview.publicProps.innerDiameter)
	assert.ok(
		exact.geometry.getAttribute('position').count >
			preview.geometry.getAttribute('position').count * 10,
	)
})

test('export builder uses the exact version of the same deformed ring state', () => {
	const fine = {
		...constantFrame(0, 100, 400),
		data: [
			[0, 0.25],
			[0.75, 1],
		],
	}
	const state = {
		ringDiameter: 17,
		weight: /** @type {const} */ ('classic'),
		bandProfile: /** @type {const} */ ('classic'),
		shoulderStyle: /** @type {const} */ ('classic'),
		fine,
		coarse: null,
		view: fine.frame,
		relief: 0.65,
		smoothing: /** @type {const} */ (0),
	}
	const preview = ring.buildDeformedMountainSignet(state, 'preview')
	const exported = ring.buildDeformedMountainSignet(state, 'exact')
	assert.equal(exported.publicProps.innerDiameter, preview.publicProps.innerDiameter)
	assert.ok(
		exported.geometry.getAttribute('position').count >
			preview.geometry.getAttribute('position').count * 10,
	)
	assert.ok(Math.abs(maximum(ring.vertexDisplacements(exported)) - 2.055) < 1e-5)
})

test('binary STL contains every triangle from the chosen mountain geometry', () => {
	const fine = {
		...constantFrame(0, 0, 1),
		data: [
			[0, 0.4],
			[0.6, 1],
		],
	}
	const state = {
		ringDiameter: 17,
		weight: /** @type {const} */ ('classic'),
		bandProfile: /** @type {const} */ ('classic'),
		shoulderStyle: /** @type {const} */ ('classic'),
		fine,
		coarse: null,
		view: fine.frame,
		relief: 0.5,
		smoothing: /** @type {const} */ (0),
	}
	const model = ring.buildDeformedMountainSignet(state, 'preview')
	const expectedTriangles = model.geometry.getIndex().count / 3
	model.geometry.dispose()
	const bytes = mountainStl.buildMountainStl(state, 'preview')
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	assert.equal(view.getUint32(80, true), expectedTriangles)
	assert.equal(bytes.byteLength, 84 + expectedTriangles * 50)
})

test('terrain deforms native face vertices through the full relief height', () => {
	const model = ring.buildMountainSignet({
		ringDiameter: 17,
		resolution: 0.2,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'classic',
	})
	const fine = {
		...constantFrame(0, 100, 400),
		data: [
			[0, 0.3],
			[0.7, 1],
		],
	}
	ring.deformMountainSignet(model, {
		fine,
		coarse: null,
		view: fine.frame,
		relief: 1,
		smoothing: 0,
	})
	const displacement = ring.vertexDisplacements(model)
	const faceValues = model.faceVertexIndices.map(index => displacement[index])
	assert.ok(Math.abs(Math.min(...faceValues)) < 1e-6)
	assert.ok(Math.abs(Math.max(...faceValues) - 3) < 1e-6)
})

test('face edge elevation continues into the first shoulder row without a wall', () => {
	const model = ring.buildMountainSignet({
		ringDiameter: 17,
		resolution: 0.2,
		weight: 'classic',
		bandProfile: 'classic',
		shoulderStyle: 'curved',
	})
	const fine = {
		...constantFrame(0, 100, 400),
		data: [
			[0, 0.2],
			[0.8, 1],
		],
	}
	ring.deformMountainSignet(model, {
		fine,
		coarse: null,
		view: fine.frame,
		relief: 0.75,
		smoothing: 0,
	})
	const displacement = ring.vertexDisplacements(model)
	for (const pair of model.faceShoulderPairs) {
		assert.ok(Math.abs(displacement[pair.face] - displacement[pair.shoulder]) < 1e-6)
	}
	for (const index of model.bottomBandVertexIndices) {
		assert.ok(Math.abs(displacement[index]) < 1e-9)
	}
})

test('x8 context changes the shoulder terrain without changing the selected face', () => {
	const options = {
		ringDiameter: 17,
		resolution: /** @type {const} */ (0.2),
		weight: /** @type {const} */ ('classic'),
		bandProfile: /** @type {const} */ ('classic'),
		shoulderStyle: /** @type {const} */ ('curved'),
	}
	const fine = {
		...constantFrame(0, 0, 100, 1),
		data: [
			[0, 0.3],
			[0.7, 1],
		],
	}
	const lowContext = constantFrame(0, 0, 1000, 8)
	const highContext = constantFrame(1, 0, 1000, 8)
	const low = ring.buildMountainSignet(options)
	const high = ring.buildMountainSignet(options)
	for (const [model, coarse] of [
		[low, lowContext],
		[high, highContext],
	]) {
		ring.deformMountainSignet(model, {
			fine,
			coarse,
			view: fine.frame,
			relief: 0.75,
			smoothing: 0,
		})
	}
	const lowDisplacement = ring.vertexDisplacements(low)
	const highDisplacement = ring.vertexDisplacements(high)
	for (const vertex of low.faceVertexIndices) {
		assert.ok(Math.abs(lowDisplacement[vertex] - highDisplacement[vertex]) < 1e-7)
	}
	assert.ok(
		low.shoulderVertexIndices.some(
			vertex => Math.abs(lowDisplacement[vertex] - highDisplacement[vertex]) > 1e-3,
		),
	)
})
