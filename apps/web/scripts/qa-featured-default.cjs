const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const hero = require('../public/hero/beshtau/metadata.json')
const base = process.env.FEATURED_QA_BASE || 'http://localhost:3003'

;(async () => {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	try {
		const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
		const requests = [], errors = []
		await context.route('**/api/admin/**', route => route.fulfill({ status: 401, json: {} }))
		await context.route(/\/tile\/|tile\.opentopomap\.org/, route => route.abort())
		await context.route('**/api/terrain/heightmap?*', route => {
			const p = new URL(route.request().url()).searchParams
			requests.push(Object.fromEntries(p))
			return route.fulfill({ json: { width: 64, height: 64, data: Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => (x + y) / 126)),
				metadata: { minElevation: 600, maxElevation: 1400, demSource: 'mapbox' },
				frame: { lat: Number(p.get('lat')), lng: Number(p.get('lng')), radiusKm: Number(p.get('radius')) / 1000, bearing: Number(p.get('bearing')) } } })
		})
		const page = await context.newPage()
		page.on('pageerror', e => errors.push(e.message))
		const snapshot = () => page.evaluate(() => {
			const s = window.__favplaceStore.getState()
			return { coords: s.location.coordinates, name: s.location.name, radius: s.radius, bearing: s.terrainBearing, height: s.reliefHeight,
				scale: s.reliefScale, size: s.ringSize, weight: s.ringWeight, band: s.bandProfile, shoulders: s.shoulderStyle, detail: s.reliefDetail, step: s.step }
		})
		await page.goto(base + '/create', { waitUntil: 'domcontentloaded' })
		await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		const initial = await snapshot()
		assert.deepEqual(initial.coords, { lat: hero.frame.lat, lng: hero.frame.lng })
		assert.equal(initial.radius, hero.frame.radiusKm * 1000); assert.equal(initial.bearing, hero.frame.bearing)
		assert.equal(initial.height, hero.configuration.height); assert.equal(initial.size, hero.configuration.size)
		assert.equal(initial.detail, hero.configuration.detail); assert.equal(initial.weight, hero.configuration.weight)
		assert.equal(initial.band, hero.configuration.bandProfile); assert.equal(initial.shoulders, hero.configuration.shoulders)
		assert.equal(initial.name, hero.place); assert.equal(initial.step, 'place')
		assert.ok(requests.length >= 3 && requests.every(r => Number(r.lat) === hero.frame.lat && Number(r.lng) === hero.frame.lng && Number(r.bearing) === hero.frame.bearing))
		await page.locator('.maplibregl-canvas').waitFor()
		await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500)
		assert.deepEqual(await snapshot(), initial)
		await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		assert.deepEqual(await snapshot(), initial)
		console.log('PASS: plain create, first terrain requests, map mount, mobile resize and reload preserve the hero configuration')
		await page.goto(base, { waitUntil: 'domcontentloaded' })
		await page.getByTestId('hero-terrain').getByRole('link', { name: /Open in studio/ }).click()
		await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		assert.deepEqual({ ...await snapshot(), step: 'place' }, initial)
		assert.deepEqual(errors, [])
		console.log('PASS: the hero link opens the exact same ring; no browser exceptions')
	} finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
