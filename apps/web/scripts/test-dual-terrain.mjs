import assert from 'node:assert/strict'
import test from 'node:test'
import { ACCEPTED_MOUNTAIN_DEFAULTS } from '../src/lib/acceptedMountainRing.ts'
import { buildAcceptedReliefModel } from '../src/lib/acceptedMountainRelief.ts'

const size = 256
const frame = { lat: 43.3499, lng: 42.4453, radiusKm: 0.5, bearing: 0 }
const make = fn => ({
	size,
	frame,
	minElev: 0,
	maxElev: 1000,
	final: true,
	data: Array.from({ length: size }, (_, r) =>
		Array.from({ length: size }, (_, c) => fn(c / (size - 1), r / (size - 1))),
	),
})

const build = extra =>
	buildAcceptedReliefModel({ ...ACCEPTED_MOUNTAIN_DEFAULTS, relief: 1, detail: 'high', ...extra })

/**
 * Вершины короны. Порог по абсолютной высоте, а не по «верхние N мм»:
 * рельеф поднимает вершину на несколько миллиметров, и окно, привязанное
 * к максимуму, уезжает с площадки на один пик.
 */
function crown(model) {
	const p = model.geometry.attributes.position.array
	const out = []
	for (let i = 0; i < p.length; i += 3) {
		if (p[i + 1] > 9.5) out.push([p[i], p[i + 1]])
	}
	return out
}

/** Размах высот в полосе |x|/halfWidth ∈ [from, to] — только по короне. */
function spread(model, from, to) {
	const pts = crown(model)
	let half = 0
	for (const [x] of pts) half = Math.max(half, Math.abs(x))
	let min = Infinity, max = -Infinity
	for (const [x, y] of pts) {
		const t = Math.abs(x) / half
		if (t < from || t > to) continue
		min = Math.min(min, y); max = Math.max(max, y)
	}
	return max - min
}

const maxY = model => {
	let m = -Infinity
	for (const [, y] of crown(model)) m = Math.max(m, y)
	return m
}

const flat = make(() => 0.5)
const bumpy = make((u, v) => 0.5 + 0.45 * Math.sin(u * 40) * Math.cos(v * 37))
const ramp = make(u => u)

test('вторая местность появляется только по краям площадки', () => {
	const model = build({ fine: flat, edge: { fine: bumpy }, edgeStart: 0.55 })
	const centre = spread(model, 0, 0.35)
	const edges = spread(model, 0.85, 1)
	console.log(`  центр (плоская местность): ${centre.toFixed(3)} мм`)
	console.log(`  края (рельефная):          ${edges.toFixed(3)} мм`)
	assert.ok(edges > centre * 2, 'края должны быть заметно рельефнее центра')
	model.geometry.dispose()
})

test('местности нормируются раздельно', () => {
	// Высоты второй местности на порядок больше: без раздельной нормировки
	// центральная сплющилась бы в ноль.
	const high = { ...make((u, v) => 0.5 + 0.4 * Math.sin(u * 30) * Math.cos(v * 30)), minElev: 0, maxElev: 9000 }
	const model = build({ fine: bumpy, edge: { fine: high }, edgeStart: 0.55 })
	const centre = spread(model, 0, 0.35)
	console.log(`  центр при соседе в 9x выше: ${centre.toFixed(3)} мм`)
	assert.ok(centre > 0.5, `центральная местность сплющена: ${centre.toFixed(3)} мм`)
	model.geometry.dispose()
})

test('без второй местности результат бит в бит прежний', () => {
	const a = build({ fine: bumpy })
	const b = build({ fine: bumpy, edge: null })
	const pa = a.geometry.attributes.position.array, pb = b.geometry.attributes.position.array
	let maxDiff = 0
	for (let i = 0; i < pa.length; i++) maxDiff = Math.max(maxDiff, Math.abs(pa[i] - pb[i]))
	console.log(`  расхождение: ${maxDiff.toExponential(2)} мм`)
	assert.equal(maxDiff, 0)
	a.geometry.dispose(); b.geometry.dispose()
})

test('высота рельефа соответствует подписи ползунка', () => {
	const low = build({ fine: ramp, relief: 0 })
	const high = build({ fine: ramp, relief: 1 })
	const gain = maxY(high) - maxY(low)
	// Амплитуда считается как .3 + 2.7*relief, значит разница краёв 2.7 мм.
	console.log(`  прирост вершины от ползунка 0 до 1: ${gain.toFixed(2)} мм (ожидаем ~2.7)`)
	assert.ok(Math.abs(gain - 2.7) < 0.6, `прирост ${gain.toFixed(2)} мм не совпал с формулой амплитуды`)
	low.geometry.dispose(); high.geometry.dispose()
})
