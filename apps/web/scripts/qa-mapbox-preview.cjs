const { chromium } = require('playwright')
const assert = require('node:assert/strict')

const base = process.env.MAPBOX_QA_BASE || 'http://localhost:3003'
const query = '?form=mountain&lat=35.3628&lng=138.7307&r=100&b=57&h=2.23&sz=19.5&w=statement&bp=d-shaped&sh=curved&d=high&p=Fuji&s=relief'
const keys = ['radius', 'terrainBearing', 'reliefHeight', 'reliefScale', 'reliefDetail', 'ringSize', 'ringWeight', 'bandProfile', 'shoulderStyle', 'step']
const snapshot = page => page.evaluate(keys => {
	const s = window.__favplaceStore.getState()
	return { ...Object.fromEntries(keys.map(key => [key, s[key]])), coordinates: s.location.coordinates }
}, keys)

;(async () => {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	try {
		const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
		const page = await context.newPage(), responses = [], errors = []
		await context.addInitScript(() => localStorage.setItem('favplace:preferences', JSON.stringify({ language: 'ru', theme: 'light' })))
		page.on('pageerror', e => errors.push(e.message))
		page.on('response', async response => {
			if (!response.url().includes('/api/terrain/heightmap')) return
			const header = response.headers()['x-terrain-metadata']
			responses.push({ query: Object.fromEntries(new URL(response.url()).searchParams), status: response.status(), metadata: header ? JSON.parse(header).metadata : null })
		})
		await context.route(/\/tile\/|tile\.opentopomap\.org/, route => route.abort())
		const stagesReady = provider => Promise.all([256, 512, 1024].map(resolution => page.waitForResponse(response => {
			if (!response.url().includes('/api/terrain/heightmap')) return false
			const p = new URL(response.url()).searchParams
			return response.status() === 200 && p.get('provider') === provider && Number(p.get('resolution')) === resolution
		})))
		const initialStages = stagesReady('mapbox')
		await page.goto(base + '/create-mapbox' + query, { waitUntil: 'domcontentloaded' })
		await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		await page.waitForFunction(() => document.title.startsWith('Mapbox'))
		await initialStages
		await page.waitForTimeout(300)
		const initial = await snapshot(page)
		assert.equal(initial.radius, 100)
		assert.equal(initial.terrainBearing, 57)
		assert.equal(initial.reliefHeight, 2.23)
		assert.ok(responses.length >= 3)
		assert.ok(responses.every(r => r.status === 200 && r.query.provider === 'mapbox' && r.metadata.demSource === 'mapbox'))
		assert.ok(responses.some(r => r.query.resolution === '1024'))
		await page.waitForTimeout(1000)
		await page.waitForFunction(() => !document.querySelector('[data-testid="mountain-ring-viewer"] [role="status"]'))
		await page.screenshot({ path: 'screenshots/dev-mapbox-comparison.png' })
		console.log('PASS: real Mapbox preview, context and final 1024 grid')
		await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
		const shared = await page.evaluate(() => navigator.clipboard.readText())
		assert.equal(new URL(shared).pathname, '/create-mapbox')
		const reopened = await context.newPage()
		await reopened.goto(shared, { waitUntil: 'domcontentloaded' })
		await reopened.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		assert.deepEqual(await snapshot(reopened), initial)
		await reopened.close()
		console.log('PASS: sharing reopens the Mapbox variant with exact ring settings')
		responses.length = 0
		const terrariumStages = stagesReady('terrarium')
		await page.getByRole('link', { name: /Сравнить с Terrarium/ }).click()
		await page.waitForURL(url => url.pathname === '/create-terrarium')
		await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		await terrariumStages
		await page.waitForTimeout(300)
		assert.deepEqual(await snapshot(page), initial)
		assert.ok(responses.length >= 3 && responses.every(r => r.query.provider === 'terrarium' && r.metadata.demSource === 'terrarium'))
		await page.waitForTimeout(1000)
		await page.waitForFunction(() => !document.querySelector('[data-testid="mountain-ring-viewer"] [role="status"]'))
		await page.screenshot({ path: 'screenshots/dev-terrarium-comparison.png' })
		console.log('PASS: Terrarium comparison uses the identical coordinates and settings')
		responses.length = 0
		await page.getByRole('link', { name: /Сравнить с Mapbox/ }).click()
		await page.waitForURL(url => url.pathname === '/create-mapbox')
		await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
		assert.deepEqual(await snapshot(page), initial)
		await page.setViewportSize({ width: 390, height: 844 })
		await page.getByRole('button', { name: 'Выбрать место', exact: true }).click()
		await page.locator('.maplibregl-canvas').waitFor()
		await page.waitForTimeout(800)
		assert.deepEqual(await snapshot(page), { ...initial, step: 'place' })
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
		await page.setViewportSize({ width: 320, height: 740 })
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
		assert.ok(responses.every(r => r.query.provider === 'mapbox'))
		assert.deepEqual(errors, [])
		console.log('PASS: switching back and mobile map mounting retain the crop; no browser exceptions')
		await context.close()
	} finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
