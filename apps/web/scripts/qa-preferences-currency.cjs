const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const base = process.env.PREFERENCES_QA_BASE || 'http://localhost:3003'

;(async () => {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	const errors = []
	async function context(options = {}) {
		const ctx = await browser.newContext(options)
		ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)))
		await ctx.route('**/api/currency/usd', route => route.fulfill({ json: { rubPerUsd: 80, date: '15.10.2026' } }))
		await ctx.route('**/api/admin/**', route => route.fulfill({ status: 401, json: { authenticated: false } }))
		await ctx.route('**/api/terrain/heightmap?*', async route => {
			const p = new URL(route.request().url()).searchParams
			await route.fulfill({ json: { width: 64, height: 64, data: Array.from({ length: 64 }, () => Array(64).fill(.5)),
				metadata: { minElevation: 100, maxElevation: 1000, demSource: 'mapbox' },
				frame: { lat: Number(p.get('lat')), lng: Number(p.get('lng')), radiusKm: Number(p.get('radius')) / 1000, bearing: Number(p.get('bearing')) } } })
		})
		return ctx
	}
	try {
		const ctx = await context(), page = await ctx.newPage()
		await page.goto(base, { waitUntil: 'domcontentloaded' })
		await page.getByText('$205.00', { exact: false }).waitFor()
		assert.equal(await page.locator('html').getAttribute('lang'), 'en')
		assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
		assert.ok(!await page.locator('body').innerText().then(text => text.includes('₽')))
		await page.getByRole('button', { name: 'Переключить на русский', exact: true }).click()
		await page.getByRole('button', { name: 'Включить светлую тему', exact: true }).click()
		await page.reload({ waitUntil: 'domcontentloaded' })
		await page.waitForFunction(() => document.documentElement.lang === 'ru' && document.documentElement.dataset.theme === 'light')
		await page.getByText(/16\s400 ₽/, { exact: false }).waitFor()
		assert.ok(await page.locator('body').innerText().then(text => /16\s400 ₽/.test(text)))
		await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
		await page.getByText('$205.00', { exact: false }).waitFor()
		console.log('PASS: fresh visitors get English/dark/USD; saved Russian/light survives reload and currency switches with language')
		await ctx.close()

		const mobile = await context({ viewport: { width: 390, height: 844 } }), order = await mobile.newPage()
		let submitted = 0
		await mobile.route('**/api/orders/checkout', async route => {
			submitted++
			assert.equal(route.request().postDataJSON().config.reliefDetail, 'high')
			await route.fulfill({ json: { id: 'qa-only', number: 'QA-ONLY', totalPrice: 18200, status: 'pending' } })
		})
		await order.goto(base + '/create?s=order&d=high', { waitUntil: 'domcontentloaded' })
		await order.getByRole('button', { name: 'Send order request · $227.50', exact: true }).waitFor()
		assert.ok(!await order.locator('body').innerText().then(text => text.includes('₽')))
		await order.getByRole('textbox', { name: /^Name/ }).fill('Alex Smith')
		await order.getByRole('textbox', { name: /^Phone/ }).fill('+1 202 555 0123')
		await order.getByRole('textbox', { name: /^Email/ }).fill('alex@example.com')
		await order.getByRole('button', { name: 'Send order request · $227.50', exact: true }).click()
		await order.getByText('Order request received', { exact: true }).waitFor()
		assert.equal(submitted, 1)
		assert.ok(await order.getByText('$227.50', { exact: true }).count() >= 1)
		assert.ok(await order.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
		console.log('PASS: USD checkout line items, total, submit button and accepted-order total agree on mobile; request is mocked')
		await mobile.close()

		for (const mode of ['corrupt', 'null', 'blocked']) {
			const fallback = await context()
			await fallback.addInitScript(mode => {
				try {
					if (mode === 'blocked') Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Storage blocked') } })
					else localStorage.setItem('favplace:preferences', mode === 'null' ? 'null' : '{broken')
				} catch { /* Opaque browser documents have no storage. */ }
			}, mode)
			const p = await fallback.newPage()
			await p.goto(base, { waitUntil: 'domcontentloaded' })
			await p.getByText('$205.00', { exact: false }).waitFor()
			assert.equal(await p.locator('html').getAttribute('lang'), 'en')
			assert.equal(await p.locator('html').getAttribute('data-theme'), 'dark')
			await fallback.close()
		}
		assert.deepEqual(errors, [])
		console.log('PASS: unavailable, malformed and null storage fall back to English/dark without browser exceptions')
	} finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
