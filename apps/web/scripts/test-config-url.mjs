import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeConfigParams, decodeConfigParams } from '../src/lib/configUrl.ts'
import { reliefMillimeters } from '../src/lib/referenceSignetTerrain.ts'

const defaults = {
	location: null, radius: 500, terrainBearing: 0, reliefScale: .5,
	reliefHeight: reliefMillimeters(.5), reliefDetail: 'high', ringForm: 'mountain',
	ringSize: 17, ringWeight: 'classic', bandProfile: 'classic', shoulderStyle: 'classic', step: 'place',
}
const withoutId = config => ({ ...config, location: config.location && { ...config.location, id: undefined } })

test('the reported legacy link restores Patagonia and its ring settings', () => {
	const restored = decodeConfigParams('?form=mountain&d=high&h=2.23&sz=17&r=20000&w=classic&bp=classic&sh=classic&b=57&lat=-49.37480&lng=-72.79745&p=El+Chalt%C3%A9n&s=relief', defaults)
	assert.deepEqual(restored.location.coordinates, { lat: -49.37480, lng: -72.79745 })
	assert.equal(restored.location.name, 'El Chaltén')
	assert.equal(restored.radius, 20000)
	assert.equal(restored.terrainBearing, 57)
	assert.equal(restored.reliefHeight, 2.23)
	assert.equal(restored.step, 'relief')
})

test('sharing preserves every active setting with full numeric precision', () => {
	for (const scale of [0, .47, .8123456789012345, 1]) {
		const original = { ...defaults, reliefScale: scale, reliefHeight: reliefMillimeters(scale),
			radius: 1337, terrainBearing: -57.1234567890123, ringSize: 19.5, reliefDetail: 'medium',
			ringWeight: 'statement', bandProfile: 'd-shaped', shoulderStyle: 'curved', step: 'form',
			location: { id: 'original', name: 'Эль Чальтен + Fitz Roy & 雪', country: 'Argentina',
				coordinates: { lat: -49.37480123456789, lng: -72.79745123456789 } },
		}
		assert.deepEqual(withoutId(decodeConfigParams(encodeConfigParams(original).toString(), defaults)), withoutId(original))
	}
})

test('zero coordinates and bearing are valid; missing and invalid values reset to defaults', () => {
	const zero = decodeConfigParams('?lat=0&lng=0&b=0&rs=0', defaults)
	assert.deepEqual(zero.location.coordinates, { lat: 0, lng: 0 })
	assert.equal(zero.reliefScale, 0)
	for (const query of ['', '?lat=&lng=&r=&h=&b=', '?lat=91&lng=181&r=Infinity&h=NaN&b=999&form=duo&sz=99&w=nope']) {
		assert.deepEqual(decodeConfigParams(query, defaults), defaults)
	}
	assert.equal(decodeConfigParams('?lat=35', defaults).location, null)
	assert.equal(decodeConfigParams('?s=material', defaults).step, 'form')
})

test('editing legacy millimetres remains possible when a saved scale is present', () => {
	const result = decodeConfigParams('?rs=.47&h=3', defaults)
	assert.equal(result.reliefHeight, 3)
	assert.equal(result.reliefScale, (3 - .54) / (4.13 - .54))
})
