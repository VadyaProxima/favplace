const { chromium } = require('playwright')
const assert = require('node:assert/strict')

const base = process.env.SHARE_QA_BASE || 'http://localhost:3003'
const legacyQuery = '?form=mountain&d=high&h=2.23&sz=17&r=20000&w=classic&bp=classic&sh=classic&b=57&lat=-49.37480&lng=-72.79745&p=El+Chalt%C3%A9n&s=relief'
const keys = ['radius', 'terrainBearing', 'reliefHeight', 'reliefScale', 'reliefDetail', 'ringForm', 'ringSize', 'ringWeight', 'bandProfile', 'shoulderStyle', 'step']
const snapshot = page => page.evaluate(keys => {
	const state = window.__favplaceStore.getState()
	return { ...Object.fromEntries(keys.map(key => [key, state[key]])),
		location: state.location && { name: state.location.name, country: state.location.country, coordinates: state.location.coordinates } }
}, keys)
const ready = page => page.waitForFunction(() => window.__favplaceStore?.getState().location && document.querySelector('[data-studio-step]'))

;(async () => {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	try {
		const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'],
			...(process.env.SHARE_QA_PROXY ? { proxy: { server: process.env.SHARE_QA_PROXY } } : {}) })
		const requests = [], errors = []
		await context.addInitScript(() => localStorage.setItem('favplace:preferences', JSON.stringify({ language: 'ru', theme: 'light' })))
		await context.route('**/api/terrain/heightmap?*', async route => {
			const p = new URL(route.request().url()).searchParams
			requests.push(Object.fromEntries(p))
			const size = 64
			await route.fulfill({ json: {
				width: size, height: size, data: Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => 100 + x * 8 + y * 3)),
				metadata: { minElevation: 100, maxElevation: 793 },
				frame: { lat: Number(p.get('lat')), lng: Number(p.get('lng')), radiusKm: Number(p.get('radius')) / 1000, bearing: Number(p.get('bearing')) },
			} })
		})
		await context.route(/\/tile\/|tile\.opentopomap\.org/, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }))
		await context.route('**/api/admin/**', route => route.fulfill({ status: 401, json: { authenticated: false } }))
		const page = await context.newPage()
		page.on('pageerror', error => errors.push(error.message))
		await page.goto(base + '/create' + legacyQuery, { waitUntil: 'domcontentloaded' })
		await ready(page)
		await page.waitForFunction(() => window.__favplaceStore.getState().terrainFrame?.final)
		const original = await snapshot(page)
		assert.deepEqual(original.location.coordinates, { lat: -49.3748, lng: -72.79745 })
		assert.equal(original.radius, 20000)
		assert.equal(original.terrainBearing, 57)
		assert.equal(original.reliefHeight, 2.23)
		assert.ok(requests.length >= 3)
		assert.ok(requests.every(r => Number(r.lat) === -49.3748 && Number(r.lng) === -72.79745), 'analysis must never start at Fuji')
		console.log('PASS: reported legacy link and first terrain requests use Patagonia')

		await page.getByRole('button', { name: 'Выбрать место', exact: true }).click()
		await page.locator('.maplibregl-canvas').waitFor()
		await page.waitForTimeout(800)
		const place = { ...original, step: 'place' }
		assert.deepEqual(await snapshot(page), place)
		for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
			await page.setViewportSize(viewport)
			await page.waitForTimeout(800)
			assert.deepEqual(await snapshot(page), place, 'resizing must preserve the geographic crop')
		}
		console.log('PASS: mounting the map and switching desktop/mobile preserve all settings')

		await page.getByRole('button', { name: 'Эльбрус', exact: true }).click()
		await page.waitForTimeout(800)
		assert.deepEqual((await snapshot(page)).location.coordinates, { lat: 43.3499, lng: 42.4453 })
		assert.equal((await snapshot(page)).radius, 20000)
		await page.getByRole('button', { name: '2 км', exact: true }).click()
		await page.waitForTimeout(800)
		assert.equal((await snapshot(page)).radius, 2000)
		await page.getByRole('button', { name: 'Приблизить карту', exact: true }).click()
		await page.waitForTimeout(800)
		assert.ok((await snapshot(page)).radius < 2000, 'user zoom must still update the selected scale')
		console.log('PASS: distant presets, scale presets and user zoom still work')
		const box = await page.locator('.maplibregl-canvas').boundingBox()
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 25, { steps: 8 })
		await page.mouse.up()
		await page.waitForTimeout(800)
		const dragged = await snapshot(page)
		assert.notDeepEqual(dragged.location.coordinates, { lat: 43.3499, lng: 42.4453 })
		await page.getByRole('navigation', { name: 'Параметры раздела' }).getByRole('button', { name: 'Настроить рельеф', exact: true }).click()
		await page.locator('[data-studio-step="relief"]').waitFor()
		await page.getByRole('button', { name: 'Выбрать место', exact: true }).click()
		await page.locator('.maplibregl-canvas').waitFor()
		await page.waitForTimeout(800)
		assert.deepEqual(await snapshot(page), dragged, 'returning to the map must retain a manually moved center')
		console.log('PASS: switching tabs retains the manually selected crop')

		await page.evaluate(() => {
			const store = window.__favplaceStore
			store.setState({ location: { id: 'qa', name: 'El Chaltén + Fitz Roy & 雪', country: 'Argentina',
				coordinates: { lat: -49.37480123456789, lng: -72.79745123456789 } },
				radius: 1337, terrainBearing: -57.1234567890123, ringSize: 19.5,
				ringWeight: 'statement', bandProfile: 'd-shaped', shoulderStyle: 'curved', reliefDetail: 'medium', step: 'form' })
			store.getState().setReliefScale(.47)
		})
		const exact = await snapshot(page)
		await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
		const shared = await page.evaluate(() => navigator.clipboard.readText())
		const reopened = await context.newPage()
		reopened.on('pageerror', error => errors.push(error.message))
		await reopened.goto(shared, { waitUntil: 'domcontentloaded' })
		await ready(reopened)
		await reopened.waitForFunction(() => window.__favplaceStore.getState().terrainFrame?.final)
		assert.deepEqual(await snapshot(reopened), exact)
		console.log('PASS: actual Share button round trip preserves every setting without rounding')
		await reopened.getByRole('button', { name: /Ландшафт/ }).click()
		await reopened.locator('.maplibregl-canvas').waitFor()
		await reopened.waitForTimeout(800)
		assert.deepEqual(await snapshot(reopened), { ...exact, step: 'place' })
		const view = await reopened.evaluate(() => window.__favplaceStore.getState().terrainViewFrame)
		assert.equal(view.lat, exact.location.coordinates.lat)
		assert.equal(view.lng, exact.location.coordinates.lng)
		assert.equal(view.radiusKm, exact.radius / 1000)
		assert.equal(view.bearing, exact.terrainBearing)
		await reopened.getByRole('navigation', { name: 'Разделы конструктора' }).getByRole('button').nth(1).click()
		await reopened.locator('[data-studio-step="form"]').waitFor()
		await reopened.waitForURL(url => url.searchParams.get('s') === 'form')

		await reopened.evaluate(query => {
			history.pushState(history.state, '', '/create' + query)
			window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
		}, legacyQuery)
		await reopened.waitForFunction(() => window.__favplaceStore.getState().step === 'relief' && window.__favplaceStore.getState().radius === 20000)
		assert.deepEqual(await snapshot(reopened), original)
		await reopened.goBack()
		await reopened.waitForFunction(() => window.__favplaceStore.getState().radius === 1337)
		assert.deepEqual(await snapshot(reopened), exact)
		assert.deepEqual(errors, [])
		console.log('PASS: history restoration resets all settings; no browser exceptions')
		await context.close()
	} finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
