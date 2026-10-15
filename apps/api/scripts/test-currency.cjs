const test = require('node:test')
const assert = require('node:assert/strict')
const { CurrencyService } = require('../dist/currency/currency.service')
const { DEFAULT_USD_EXCHANGE_RATE } = require('@favplace/shared')

test('currency refresh deduplicates requests, caches successful quotes, retains stale quotes during outages and recovers', async () => {
	const originalFetch = fetch, originalNow = Date.now
	let now = originalNow(), calls = 0, down = false, rate = 80
	Date.now = () => now
	globalThis.fetch = async () => {
		calls++
		await new Promise(resolve => setImmediate(resolve))
		if (down) throw new Error('offline')
		return new Response(`<ValCurs Date="15.10.2026"><Valute><Nominal>1</Nominal><CharCode>USD</CharCode><Value>${rate}</Value></Valute></ValCurs>`)
	}
	try {
		const service = new CurrencyService()
		const [first, second] = await Promise.all([service.getRate(), service.getRate()])
		assert.deepEqual(first, { date: '15.10.2026', rubPerUsd: 80 }); assert.equal(first, second); assert.equal(calls, 1)
		await service.getRate(); assert.equal(calls, 1)
		now += 3_600_001; down = true
		assert.equal(await service.getRate(), first); assert.equal(calls, 2)
		await service.getRate(); assert.equal(calls, 2)
		now += 60_001; down = false; rate = 82
		assert.equal((await service.getRate()).rubPerUsd, 82); assert.equal(calls, 3)
		down = true
		assert.deepEqual(await new CurrencyService().getRate(), DEFAULT_USD_EXCHANGE_RATE)
	} finally { globalThis.fetch = originalFetch; Date.now = originalNow }
})
