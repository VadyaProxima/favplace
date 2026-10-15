const test = require('node:test')
const assert = require('node:assert/strict')
const { OrdersService } = require('../dist/orders/orders.service')

test('orders use the fixed server price in the requested currency; legacy clients keep RUB', async () => {
	const saved = [], notifications = []
	const prisma = { $queryRaw: async () => [{ nextval: 1n }], order: { create: async ({ data }) => { saved.push(data); return { id: 'qa', ...data } } } }
	const service = new OrdersService(prisma)
	service.notify = async (...args) => { notifications.push(args) } // Never send real notifications.
	const input = {
		config: { ringForm: 'mountain', ringSize: 17, material: 'silver', surfaceFinish: 'polished', reliefDetail: 'high',
			reliefHeight: 3.77, twoTone: false, engraving: '', radius: 2179, location: { name: 'Бештау', country: '', lat: 44.09865, lng: 43.02519 } },
		customer: { name: 'Alex Smith', email: 'alex@example.com', phone: '+12025550123', delivery: '' },
	}
	for (const [currency, expected] of [['USD', 230], ['RUB', 18200], [undefined, 18200]]) {
		const order = await service.checkout({ ...input, currency, totalPrice: 1 })
		assert.equal(order.totalPrice, expected); assert.equal(order.currency, currency ?? 'RUB')
		assert.equal(saved.at(-1).totalPrice, expected); assert.equal(saved.at(-1).currency, currency ?? 'RUB')
		assert.equal(notifications.at(-1).at(-1), currency ?? 'RUB')
	}
	await assert.rejects(service.checkout({ ...input, currency: 'EUR' }), error => error.getStatus() === 400)
	assert.equal(saved.length, 3)
})
