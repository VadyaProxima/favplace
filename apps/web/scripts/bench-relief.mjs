import { buildAcceptedMountainRing, ACCEPTED_MOUNTAIN_DEFAULTS } from '../src/lib/acceptedMountainRing.ts'
import { buildAcceptedReliefModel } from '../src/lib/acceptedMountainRelief.ts'

const size = 1024
const frame = { lat: 43.3499, lng: 42.4453, radiusKm: 0.446, bearing: 0 }
const data = Array.from({ length: size }, (_, r) =>
	Array.from({ length: size }, (_, c) =>
		0.5 + 0.2 * Math.sin(c * 0.31) * Math.cos(r * 0.27) + 0.15 * Math.sin(c * 0.11 + r * 0.17),
	),
)
const fine = { size, frame, minElev: 5286, maxElev: 5632, final: true, data }

const time = (label, fn, runs = 3) => {
	fn() // прогрев
	const marks = []
	for (let i = 0; i < runs; i++) {
		const t = performance.now()
		const out = fn()
		marks.push(performance.now() - t)
		out?.geometry?.dispose?.()
	}
	marks.sort((a, b) => a - b)
	console.log(`  ${label.padEnd(46)} ${marks[Math.floor(runs / 2)].toFixed(0)} мс`)
}

console.log('сборка кольца и рельефа:')
time('buildAcceptedMountainRing (база)', () => buildAcceptedMountainRing(ACCEPTED_MOUNTAIN_DEFAULTS))

for (const detail of ['low', 'medium', 'high']) {
	time(`buildAcceptedReliefModel detail=${detail}`, () =>
		buildAcceptedReliefModel({ ...ACCEPTED_MOUNTAIN_DEFAULTS, fine, relief: 0.5, detail }),
	)
}

// Сколько стоит только выборка высот — без построения сетки
console.log('\nразбор данных:')
const json = JSON.stringify({ data })
console.log(`  JSON heightmap ${size}x${size}`.padEnd(48) + ` ${(json.length / 1048576).toFixed(1)} МБ`)
const t = performance.now()
JSON.parse(json)
console.log(`  JSON.parse этого объёма`.padEnd(48) + ` ${(performance.now() - t).toFixed(0)} мс`)

// Промежуточная ступень: кадр 256, увеличение на сетку 384
const small=256
const fine256={size:small,frame,minElev:5286,maxElev:5632,final:false,
 data:Array.from({length:small},(_,r)=>Array.from({length:small},(_,c)=>0.5+0.2*Math.sin(c*0.31)*Math.cos(r*0.27)+0.15*Math.sin(c*0.11+r*0.17)))}
console.log("\nпромежуточный кадр 256 (увеличение):")
for(const detail of ["low","medium","high"])
 time(`detail=${detail}`,()=>buildAcceptedReliefModel({...ACCEPTED_MOUNTAIN_DEFAULTS,fine:fine256,relief:0.5,detail}))
