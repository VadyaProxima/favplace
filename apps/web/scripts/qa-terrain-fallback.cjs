const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const base = 'http://localhost:3003'
const query = '?form=mountain&lat=35.3628&lng=138.7307&r=100&b=57&h=2.23&sz=19.5&w=statement&bp=d-shaped&sh=curved&d=high&p=Fuji&s=relief'

;(async () => {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	try {
		for (const source of ['mapbox', 'terrarium']) {
			const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
			const page = await context.newPage(), errors = [], metadata = []
			page.on('pageerror', e => errors.push(e.message))
			await context.route(/\/tile\/|tile\.opentopomap\.org/, route => route.abort())
			if (source === 'terrarium') await context.route('**/api/terrain/heightmap?*', async route => {
				const url = new URL(route.request().url())
				const result = await fetch('http://127.0.0.1:4001' + url.pathname + url.search)
				await route.fulfill({ status: result.status, headers: Object.fromEntries(result.headers), body: Buffer.from(await result.arrayBuffer()) })
			})
			page.on('response', response => {
				if (!response.url().includes('/api/terrain/heightmap')) return
				assert.equal(response.status(), 200)
				assert.equal(new URL(response.url()).searchParams.has('provider'), false, 'ordinary create must use automatic server selection')
				metadata.push(JSON.parse(response.headers()['x-terrain-metadata']))
			})
			const stages = Promise.all([256, 512, 1024].map(size => page.waitForResponse(response =>
				response.url().includes('/api/terrain/heightmap') && Number(new URL(response.url()).searchParams.get('resolution')) === size)))
			await page.goto(base + '/create' + query, { waitUntil: 'domcontentloaded' })
			await stages
			await page.waitForFunction(() => window.__favplaceStore?.getState().terrainFrame?.final)
			const state = await page.evaluate(() => {
				const s = window.__favplaceStore.getState()
				return { lat: s.location.coordinates.lat, lng: s.location.coordinates.lng, radius: s.radius, bearing: s.terrainBearing,
					height: s.reliefHeight, size: s.ringSize, source: s.terrainFrame.demSource, coarseSource: s.coarseTerrainFrame?.demSource,
					resolution: s.terrainFrame.size, weight: s.ringWeight, band: s.bandProfile, shoulder: s.shoulderStyle }
			})
			assert.deepEqual({ ...state, coarseSource: undefined }, { lat: 35.3628, lng: 138.7307, radius: 100, bearing: 57, height: 2.23,
				size: 19.5, source, coarseSource: undefined, resolution: 1024, weight: 'statement', band: 'd-shaped', shoulder: 'curved' })
			assert.ok(!state.coarseSource || state.coarseSource === source)
			assert.ok(metadata.length >= 3 && metadata.every(m => m.metadata.demSource === source))
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
			await page.locator('[data-testid="mountain-ring-viewer"] canvas').waitFor()
			assert.deepEqual(errors, [])
			console.log(`PASS: ordinary create renders real ${source} data at 1024 with unchanged settings and no browser exceptions`)
			await context.close()
		}
	} finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
