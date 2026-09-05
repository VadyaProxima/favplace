/**
 * Замкнутость базовых форм (квадрат / круг / овал) на настоящей basic_ring.glb.
 *
 * Проверяем ровно тот путь, которым идёт кнопка «Скачать STL»:
 * prepareBasicRingFromGlb → collectTriangles → auditMesh.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { prepareBasicRingFromGlb } from '../src/lib/basicRingFromGlb.ts'
import { calibratedReliefHeight } from '../src/lib/reliefCalibration.ts'
import { MAX_RELIEF_MM } from '../src/lib/referenceSignetTerrain.ts'
import { buildStlExport } from '../src/lib/stlExport.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const glbPath = path.join(here, '..', 'public', 'models', 'basic_ring.glb')

function loadGlb() {
	const buffer = fs.readFileSync(glbPath)
	const arrayBuffer = buffer.buffer.slice(
		buffer.byteOffset,
		buffer.byteOffset + buffer.byteLength,
	)
	return new Promise((resolve, reject) => {
		new GLTFLoader().parse(arrayBuffer, '', resolve, reject)
	})
}

const heightMap = Array.from({ length: 64 }, (_, row) =>
	Array.from({ length: 64 }, (_, column) => {
		const u = column / 63 - 0.5
		const v = row / 63 - 0.5
		return Math.max(0, 1 - Math.hypot(u, v) * 2) ** 1.6
	}),
)

const MATERIAL = {
	color: '#c0c0c0',
	metalness: 1,
	roughness: 0.2,
	polished: true,
}

const gltf = await loadGlb()

/** Сетка вставки — 256×256, см. buildReliefGeometry. */
const RELIEF_SEGMENTS = 256
const RELIEF_TOP_COUNT = (RELIEF_SEGMENTS + 1) * (RELIEF_SEGMENTS + 1)
const RELIEF_PERIMETER = 4 * RELIEF_SEGMENTS

/**
 * Периметр вставки посажен на медианную плоскость площадки, а настоящая
 * поверхность GLB у края уходит ниже — отсюда и была видна щель. Меряем её
 * лучом вниз и сравниваем с глубиной стенки.
 */
function rimGapVsWall(root, mmPerUnit) {
	const relief = root.getObjectByName('terrain-relief')
	const body = root.children.find(child => child !== relief)
	const position = relief.geometry.getAttribute('position')
	const ray = new THREE.Raycaster()

	let widestGap = -Infinity
	let shallowestWall = Infinity
	let misses = 0
	for (let i = 0; i < RELIEF_PERIMETER; i++) {
		const rim = RELIEF_TOP_COUNT + i
		const floor = RELIEF_TOP_COUNT + RELIEF_PERIMETER + i
		const x = position.getX(rim)
		const y = position.getY(rim)
		const z = position.getZ(rim)
		shallowestWall = Math.min(shallowestWall, (y - position.getY(floor)) * mmPerUnit)

		ray.set(new THREE.Vector3(x, y + 10, z), new THREE.Vector3(0, -1, 0))
		const hits = ray.intersectObject(body, true)
		if (hits.length === 0) {
			misses++
			continue
		}
		widestGap = Math.max(widestGap, (y - hits[0].point.y) * mmPerUnit)
	}
	return { widestGap, shallowestWall, misses }
}

for (const variant of ['square', 'circle', 'oval']) {
	test(`${variant}: меш замкнут и годится литейщику`, () => {
		// gltf переиспользуется между вариантами, поэтому геометрия клонируется
		// внутри prepareBasicRingFromGlb — исходную сцену это не портит.
		const root = prepareBasicRingFromGlb(
			gltf,
			variant,
			heightMap,
			calibratedReliefHeight(variant, MAX_RELIEF_MM),
			MATERIAL,
		)
		const { audit } = buildStlExport(root, {
			ringSizeMm: 17,
			filename: `test-${variant}.stl`,
		})

		assert.equal(
			audit.boundaryEdges,
			0,
			`${variant}: ${audit.boundaryEdges} граничных рёбер`,
		)
		assert.equal(
			audit.nonManifoldEdges,
			0,
			`${variant}: ${audit.nonManifoldEdges} неманифолдных рёбер`,
		)
		assert.equal(audit.watertight, true)
	})

	test(`${variant}: стенка вставки перекрывает щель до корпуса`, () => {
		const root = prepareBasicRingFromGlb(
			gltf,
			variant,
			heightMap,
			calibratedReliefHeight(variant, MAX_RELIEF_MM),
			MATERIAL,
		)
		const { audit } = buildStlExport(root, {
			ringSizeMm: 17,
			filename: `test-${variant}.stl`,
		})

		// Снимаем трансформ корня, чтобы локальные координаты совпали с мировыми.
		root.position.set(0, 0, 0)
		root.scale.setScalar(1)
		root.updateMatrixWorld(true)
		const unscaled = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())

		const { widestGap, shallowestWall, misses } = rimGapVsWall(
			root,
			audit.size.y / unscaled.y,
		)

		assert.equal(misses, 0, `${variant}: ${misses} лучей не нашли корпус`)
		assert.ok(
			shallowestWall > widestGap,
			`${variant}: стенка ${shallowestWall.toFixed(3)} мм не перекрывает щель ${widestGap.toFixed(3)} мм`,
		)
	})
}
