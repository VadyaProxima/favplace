import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'

/**
 * Проверки, без которых литейщик не возьмёт файл в работу.
 *
 * Все длины — в миллиметрах: геометрия сюда приходит уже отмасштабированной
 * (см. scaleToRingSize в stlExport.ts).
 */

export interface MeshAudit {
	triangles: number
	/** Габариты изделия, мм */
	size: { x: number; y: number; z: number }
	/** Замкнутость: ребро должно принадлежать ровно двум треугольникам */
	watertight: boolean
	/** Рёбра на границе дырки (использованы один раз) */
	boundaryEdges: number
	/** Рёбра, где сходится больше двух граней — литьё такое не примет */
	nonManifoldEdges: number
	/** Треугольники нулевой площади */
	degenerate: number
	/** Минимальная измеренная толщина металла, мм (null — замерить не удалось) */
	minThickness: number | null
	/** 1-й процентиль толщины — устойчивее минимума к единичным выбросам */
	p1Thickness: number | null
	/** Сколько точек реально прозвонили лучом */
	thicknessSamples: number
}

/** Ниже этого литьё в серебре обычно рвётся или не проливается. */
export const MIN_CASTABLE_WALL_MM = 0.6

/** Квантование координат при склейке вершин, мм. */
const WELD_EPS = 1e-3

function key(x: number, y: number, z: number): string {
	const q = (v: number) => Math.round(v / WELD_EPS)
	return `${q(x)},${q(y)},${q(z)}`
}

/**
 * Замкнутость через подсчёт использований каждого ребра.
 * Вершины склеиваются по округлённым координатам — иначе соседние
 * треугольники из разных полос сетки считаются несвязанными.
 */
function auditTopology(pos: Float32Array) {
	const edges = new Map<string, number>()
	let degenerate = 0

	const triCount = pos.length / 9
	for (let t = 0; t < triCount; t++) {
		const o = t * 9
		const ax = pos[o], ay = pos[o + 1], az = pos[o + 2]
		const bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5]
		const cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8]

		// Площадь — половина длины векторного произведения
		const ux = bx - ax, uy = by - ay, uz = bz - az
		const vx = cx - ax, vy = cy - ay, vz = cz - az
		const nx = uy * vz - uz * vy
		const ny = uz * vx - ux * vz
		const nz = ux * vy - uy * vx
		if (Math.sqrt(nx * nx + ny * ny + nz * nz) < 1e-9) {
			degenerate++
			continue
		}

		const ka = key(ax, ay, az)
		const kb = key(bx, by, bz)
		const kc = key(cx, cy, cz)

		for (const [p, q] of [
			[ka, kb],
			[kb, kc],
			[kc, ka],
		] as const) {
			// Ребро без направления: (a,b) и (b,a) — одно и то же
			const e = p < q ? `${p}|${q}` : `${q}|${p}`
			edges.set(e, (edges.get(e) ?? 0) + 1)
		}
	}

	let boundaryEdges = 0
	let nonManifoldEdges = 0
	for (const count of edges.values()) {
		if (count === 1) boundaryEdges++
		else if (count > 2) nonManifoldEdges++
	}

	return { boundaryEdges, nonManifoldEdges, degenerate }
}

/**
 * Толщина металла: из центра каждой грани пускаем луч внутрь тела вдоль
 * -normal и смотрим, где он выйдет наружу. Считаем по выборке граней —
 * полный проход по 200k треугольников не нужен, а BVH делает это быстро.
 */
function auditThickness(geometry: THREE.BufferGeometry, pos: Float32Array) {
	const triCount = pos.length / 9
	if (triCount === 0) return { minThickness: null, p1Thickness: null, samples: 0 }

	const bvh = new MeshBVH(geometry)
	const ray = new THREE.Ray()
	const origin = new THREE.Vector3()
	const dir = new THREE.Vector3()

	const TARGET_SAMPLES = 4000
	const stride = Math.max(1, Math.floor(triCount / TARGET_SAMPLES))
	// Отступ от поверхности, чтобы луч не поймал собственную грань
	const EPS = 1e-3

	const hits: number[] = []
	for (let t = 0; t < triCount; t += stride) {
		const o = t * 9
		const ax = pos[o], ay = pos[o + 1], az = pos[o + 2]
		const bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5]
		const cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8]

		const ux = bx - ax, uy = by - ay, uz = bz - az
		const vx = cx - ax, vy = cy - ay, vz = cz - az
		let nx = uy * vz - uz * vy
		let ny = uz * vx - ux * vz
		let nz = ux * vy - uy * vx
		const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
		if (len < 1e-9) continue
		nx /= len; ny /= len; nz /= len

		// Внутрь тела — против внешней нормали
		dir.set(-nx, -ny, -nz)
		origin.set(
			(ax + bx + cx) / 3 + dir.x * EPS,
			(ay + by + cy) / 3 + dir.y * EPS,
			(az + bz + cz) / 3 + dir.z * EPS,
		)
		ray.set(origin, dir)

		// BackSide: изнутри тела мы видим обратную сторону дальней грани
		const hit = bvh.raycastFirst(ray, THREE.BackSide)
		if (hit && hit.distance > EPS) hits.push(hit.distance + EPS)
	}

	if (hits.length === 0) return { minThickness: null, p1Thickness: null, samples: 0 }

	hits.sort((a, b) => a - b)
	return {
		minThickness: hits[0],
		p1Thickness: hits[Math.floor(hits.length * 0.01)],
		samples: hits.length,
	}
}

export function auditMesh(geometry: THREE.BufferGeometry): MeshAudit {
	const pos = geometry.getAttribute('position').array as Float32Array
	const { boundaryEdges, nonManifoldEdges, degenerate } = auditTopology(pos)

	geometry.computeBoundingBox()
	const box = geometry.boundingBox!
	const size = new THREE.Vector3()
	box.getSize(size)

	const thickness = auditThickness(geometry, pos)

	return {
		triangles: pos.length / 9,
		size: { x: size.x, y: size.y, z: size.z },
		watertight: boundaryEdges === 0 && nonManifoldEdges === 0,
		boundaryEdges,
		nonManifoldEdges,
		degenerate,
		minThickness: thickness.minThickness,
		p1Thickness: thickness.p1Thickness,
		thicknessSamples: thickness.samples,
	}
}

/** Человекочитаемые замечания для панели экспорта. */
export function auditWarnings(a: MeshAudit): string[] {
	const w: string[] = []
	if (a.boundaryEdges > 0) {
		w.push(
			`Меш не замкнут: ${a.boundaryEdges} граничных рёбер. Литейщик такой файл не примет — нужна заливка дырок.`,
		)
	}
	if (a.nonManifoldEdges > 0) {
		w.push(
			`${a.nonManifoldEdges} немногообразных рёбер (сходится больше двух граней). Обычно это следы булевых операций.`,
		)
	}
	if (a.degenerate > 0) {
		w.push(`${a.degenerate} вырожденных треугольников нулевой площади — они выброшены из файла.`)
	}
	if (a.p1Thickness !== null && a.p1Thickness < MIN_CASTABLE_WALL_MM) {
		w.push(
			`Тонкий металл: 1% поверхности тоньше ${a.p1Thickness.toFixed(2)} мм при пороге ${MIN_CASTABLE_WALL_MM} мм. Рискует не пролиться или сломаться при полировке.`,
		)
	}
	if (a.thicknessSamples === 0) {
		w.push('Толщину замерить не удалось — вероятно, нормали вывернуты наружу.')
	}
	return w
}
