import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAcceptedReliefModel } from '../src/lib/acceptedMountainRelief.ts'
import { watertightReport } from '../src/lib/referenceMountainSignet.ts'

const size = 512
const frame = { lat: 35.3628, lng: 138.7307, radiusKm: 1.5, bearing: 0 }
const fine = { size, frame, minElev: 1500, maxElev: 3700, final: false,
	data: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => .5 + .3 * Math.sin(x / 70) * Math.cos(y / 90))) }

test('the live preview is closed and preserves the protected lower ring', () => {
	const exact = buildAcceptedReliefModel({ fine, detail: 'high', relief: .7 })
	const preview = buildAcceptedReliefModel({ fine, detail: 'high', relief: .7, preview: true })
	assert.deepEqual(watertightReport(preview.geometry), { boundaryEdges: 0, nonManifoldEdges: 0 })
	assert.ok(preview.geometry.index.count < exact.geometry.index.count * .65)
	const a = exact.geometry.attributes.position.array, b = preview.geometry.attributes.position.array
	// Original body vertices precede all new crown/transition vertices in both models.
	for (let i = 0; i < 20000; i++) {
		if (a[i * 3 + 1] < 8.5) {
			assert.equal(b[i * 3], a[i * 3]); assert.equal(b[i * 3 + 1], a[i * 3 + 1]); assert.equal(b[i * 3 + 2], a[i * 3 + 2])
		}
	}
	assert.ok(Math.abs(preview.geometry.boundingBox.max.y - exact.geometry.boundingBox.max.y) < .05)
	for (const value of preview.geometry.attributes.normal.array) assert.ok(Number.isFinite(value))
	exact.geometry.dispose(); preview.geometry.dispose()
})

test('moving inside an already loaded region changes the model without new heights', () => {
	const a = buildAcceptedReliefModel({ fine, preview: true, view: { ...frame, radiusKm: .5 } })
	const b = buildAcceptedReliefModel({ fine, preview: true, view: { ...frame, lng: frame.lng + .002, radiusKm: .5 } })
	let maximum = 0
	const first = a.geometry.attributes.position.array, second = b.geometry.attributes.position.array
	for (let i = 1; i < first.length; i += 3) maximum = Math.max(maximum, Math.abs(first[i] - second[i]))
	assert.ok(maximum > .1, 'the ring must respond to geographic movement before a new API response')
	a.geometry.dispose(); b.geometry.dispose()
})
