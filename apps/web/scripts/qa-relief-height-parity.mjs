/**
 * Сколько миллиметров рельефа реально даёт каждая форма при одном ползунке.
 *
 * У форм разные формулы перевода `reliefHeight` в геометрию, поэтому при
 * одинаковом значении ползунка металл поднимался на разную высоту. Меряем
 * так же, как это видит человек: пик рельефа над площадкой.
 *
 * Приём — две сборки одной формы: с плоской картой высот (рельефа нет,
 * виден уровень площадки) и с конусом от 0 до 1 (пик ровно в центре).
 * Разница верхних границ и есть высота рельефа.
 *
 * Аргументы билдеров повторяют вьюеры один в один — иначе меряли бы не то,
 * что видит человек.
 *
 *   node scripts/qa-relief-height-parity.mjs [--raw]
 *
 * --raw — без калибровки, чтобы увидеть исходный разброс.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { prepareSignetFromGlb, SIGNET_GLB_PATH } from '../src/lib/signetFromGlb.ts'
import {
	prepareBasicRingFromGlb,
	BASIC_RING_GLB_PATH,
} from '../src/lib/basicRingFromGlb.ts'
import { buildDiscRing, buildPlugRing } from '../src/lib/discRing.ts'
import { buildBarRing } from '../src/lib/barRing.ts'
import { buildDeformedMountainSignet } from '../src/lib/referenceMountainSignet.ts'
import { buildStlExport } from '../src/lib/stlExport.ts'
import {
	MIN_RELIEF_MM,
	MAX_RELIEF_MM,
} from '../src/lib/referenceSignetTerrain.ts'
import {
	calibratedReliefHeight,
	calibratedReliefScale,
} from '../src/lib/reliefCalibration.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(here, '..', 'public')

const RAW = process.argv.includes('--raw')
const RING_SIZE_MM = 17
/** Края реального диапазона ползунка, середина и высота по умолчанию. */
const SLIDERS = [MIN_RELIEF_MM, 1.65, 2.34, 3.5, MAX_RELIEF_MM]

const scaleOf = (mm) => (mm - MIN_RELIEF_MM) / (MAX_RELIEF_MM - MIN_RELIEF_MM)

const GRID = 64
const cone = Array.from({ length: GRID }, (_, row) =>
	Array.from({ length: GRID }, (_, column) => {
		const u = column / (GRID - 1) - 0.5
		const v = row / (GRID - 1) - 0.5
		return Math.max(0, 1 - Math.hypot(u, v) * 2)
	}),
)
const flat = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => 0))

const MATERIAL = {
	color: '#c0c0c0',
	metalness: 1,
	roughness: 0.2,
	polished: true,
}

function loadGlb(relativePath) {
	const file = fs.readFileSync(path.join(publicDir, relativePath))
	const arrayBuffer = file.buffer.slice(
		file.byteOffset,
		file.byteOffset + file.byteLength,
	)
	return new Promise((resolve, reject) => {
		new GLTFLoader().parse(arrayBuffer, '', resolve, reject)
	})
}

const signetGltf = await loadGlb(SIGNET_GLB_PATH)
const basicGltf = await loadGlb(BASIC_RING_GLB_PATH)

function rootFromGeometry(geometry) {
	const root = new THREE.Group()
	root.add(new THREE.Mesh(geometry))
	return root
}

/**
 * Снимаем нормировку под вьюер: она подгоняет модель под фиксированный
 * габарит, и верх рельефа всегда оказывается на одной высоте независимо
 * от ползунка. Меряем в исходных единицах модели.
 */
function unnormalized(root) {
	root.position.set(0, 0, 0)
	root.scale.setScalar(1)
	root.updateMatrixWorld(true)
	return root
}

/**
 * Верхняя граница рельефа. Где вставка — отдельный меш, меряем именно её:
 * у классического и базовых форм шинка выше площадки. У диска, планки и
 * горы рельеф слит с корпусом, там верх габарита и есть пик рельефа.
 */
function topY(root) {
	const target = root.getObjectByName('terrain-relief') ?? root
	return new THREE.Box3().setFromObject(target).max.y
}

/** Высота, которую форма получает на вход: с калибровкой или без. */
const height = (form, slider) =>
	RAW ? slider : calibratedReliefHeight(form, slider)

const FORMS = [
	{
		id: 'classic',
		label: 'Классический',
		build: (heightMap, slider) =>
			prepareSignetFromGlb(signetGltf, heightMap, height('classic', slider), MATERIAL),
	},
	{
		id: 'mountain',
		label: 'Горный',
		/** Строится сразу в миллиметрах, масштабировать не нужно. */
		millimetres: true,
		build: (heightMap, slider) =>
			rootFromGeometry(
				buildDeformedMountainSignet(
					{
						ringDiameter: RING_SIZE_MM,
						weight: 'classic',
						bandProfile: 'classic',
						shoulderStyle: 'classic',
						fine: {
							data: heightMap,
							size: heightMap.length,
							minElev: 0,
							maxElev: 1,
							frame: { lat: 0, lng: 0, radiusKm: 1, bearing: 0 },
							final: true,
						},
						coarse: null,
						view: { lat: 0, lng: 0, radiusKm: 1, bearing: 0 },
						relief: RAW ? scaleOf(slider) : calibratedReliefScale(scaleOf(slider)),
						smoothing: 0,
					},
					'preview',
				).geometry,
			),
	},
	{
		id: 'disc',
		label: 'Диск',
		build: (heightMap, slider) =>
			rootFromGeometry(buildDiscRing(heightMap, height('disc', slider))),
	},
	{
		id: 'plug',
		label: 'Цилиндр',
		build: (heightMap, slider) =>
			rootFromGeometry(buildPlugRing(heightMap, height('plug', slider))),
	},
	{
		id: 'bar',
		label: 'Планка',
		build: (heightMap, slider) =>
			rootFromGeometry(buildBarRing(heightMap, height('bar', slider))),
	},
	...['square', 'circle', 'oval'].map((variant) => ({
		id: variant,
		label: { square: 'Квадрат', circle: 'Круг', oval: 'Овал' }[variant],
		build: (heightMap, slider) =>
			prepareBasicRingFromGlb(
				basicGltf,
				variant,
				heightMap,
				height(variant, slider),
				MATERIAL,
			),
	})),
]

function measure(form, slider) {
	const baseline = unnormalized(form.build(flat, slider))
	const raised = unnormalized(form.build(cone, slider))

	// Масштаб берём с плоской сборки: рельеф на посадочное отверстие не влияет.
	let mmPerUnit = 1
	if (!form.millimetres) {
		const { audit } = buildStlExport(baseline, {
			ringSizeMm: RING_SIZE_MM,
			filename: 'x.stl',
		})
		mmPerUnit =
			audit.size.y /
			new THREE.Box3().setFromObject(baseline).getSize(new THREE.Vector3()).y
	}
	return (topY(raised) - topY(baseline)) * mmPerUnit
}

console.log(
	`${RAW ? 'БЕЗ калибровки' : 'с калибровкой'}, кольцо ⌀${RING_SIZE_MM} мм. ` +
		'Высота рельефа над площадкой, мм.\n',
)
console.log(
	'форма'.padEnd(15) + SLIDERS.map((s) => `${s.toFixed(2)}`.padStart(9)).join('') + '     разброс к эталону',
)

const rows = FORMS.map((form) => ({
	form,
	heights: SLIDERS.map((slider) => measure(form, slider)),
}))
const reference = rows.find((row) => row.form.id === 'classic')

for (const row of rows) {
	const spread = row.heights.map((h, i) => h / reference.heights[i])
	const worst = spread.reduce(
		(acc, r) => Math.max(acc, Math.abs(r - 1)),
		0,
	)
	console.log(
		row.form.label.padEnd(15) +
			row.heights.map((h) => h.toFixed(3).padStart(9)).join('') +
			`     ${(Math.min(...spread) * 100).toFixed(0)}–${(Math.max(...spread) * 100).toFixed(0)}%` +
			(row.form.id === 'classic' ? '  (эталон)' : worst <= 0.05 ? '  ✓' : '  ✗'),
	)
}
