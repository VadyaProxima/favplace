import * as THREE from 'three'
import { auditMesh, type MeshAudit } from './meshAudit.ts'

/**
 * Экспорт отрисованного изделия в STL для литья.
 *
 * Геометрия берётся из живого меша сцены (см. exportTarget.ts), а не строится
 * заново, поэтому файл всегда соответствует превью. Единицы сцены переводятся
 * в миллиметры по фактическому диаметру посадочного отверстия.
 */

/**
 * Сплющивает дерево объектов в один массив треугольников в мировых
 * координатах. STL не хранит ни нормалей вершин, ни UV, ни материалов —
 * только позиции, поэтому остальные атрибуты не переносим.
 */
function collectTriangles(root: THREE.Object3D): Float32Array {
	root.updateWorldMatrix(true, true)
	const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()

	const chunks: Float32Array[] = []
	const v = new THREE.Vector3()
	const matrix = new THREE.Matrix4()

	root.traverse(obj => {
		const mesh = obj as THREE.Mesh
		if (!mesh.isMesh || !mesh.geometry) return

		const geometry = mesh.geometry as THREE.BufferGeometry
		const position = geometry.getAttribute('position')
		if (!position) return

		// Приводим к системе координат корня, чтобы экспорт не зависел
		// от того, куда вьюер сдвинул изделие для красивого кадра.
		matrix.multiplyMatrices(inverseRoot, mesh.matrixWorld)

		const index = geometry.getIndex()
		const count = index ? index.count : position.count
		const out = new Float32Array(count * 3)

		for (let i = 0; i < count; i++) {
			const vi = index ? index.getX(i) : i
			v.fromBufferAttribute(position, vi).applyMatrix4(matrix)
			out[i * 3] = v.x
			out[i * 3 + 1] = v.y
			out[i * 3 + 2] = v.z
		}
		chunks.push(out)
	})

	const total = chunks.reduce((n, c) => n + c.length, 0)
	const merged = new Float32Array(total)
	let offset = 0
	for (const c of chunks) {
		merged.set(c, offset)
		offset += c.length
	}
	return merged
}

/**
 * Радиус посадочного отверстия в единицах сцены.
 *
 * Процедурные формы строятся от innerRadius = 1, но GLB-модели
 * нормируются по габариту (basicRingFromGlb.ts:349), поэтому единый
 * коэффициент не годится — отверстие измеряем по самой геометрии.
 */
function measureBoreRadius(pos: Float32Array): number | null {
	if (pos.length === 0) return null

	const box = new THREE.Box3()
	const p = new THREE.Vector3()
	for (let i = 0; i < pos.length; i += 3) {
		box.expandByPoint(p.set(pos[i], pos[i + 1], pos[i + 2]))
	}
	const size = new THREE.Vector3()
	const center = new THREE.Vector3()
	box.getSize(size)
	box.getCenter(center)

	// Ось кольца — направление вдоль пальца, самый узкий габарит
	const axis: 0 | 1 | 2 =
		size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2
	const a = axis === 0 ? 1 : 0
	const b = axis === 2 ? 1 : 2

	let cu = [center.x, center.y, center.z][a]
	let cv = [center.x, center.y, center.z][b]
	let radius = Math.min(size.getComponent(a), size.getComponent(b)) / 2

	// Центр габаритов — плохая отправная точка: у печатки голова смещает его
	// вверх, и полоса «ближайших к оси» вершин вырождается в серп. Поэтому
	// на каждой итерации подгоняем окружность по дуге методом Каса — он
	// использует кривизну, а не положение, и с серпом справляется.
	for (let pass = 0; pass < 12; pass++) {
		let rMin = Infinity
		for (let i = 0; i < pos.length; i += 3) {
			const r = Math.hypot(pos[i + a] - cu, pos[i + b] - cv)
			if (r < rMin) rMin = r
		}
		if (!Number.isFinite(rMin) || rMin < 1e-9) return null

		// Полосу сужаем с итерациями: сперва нужен грубый охват стенки,
		// под конец — только вершины, реально лежащие на ней.
		const band = rMin * (pass < 6 ? 1.08 : 1.01)

		const fit = fitCircle(pos, a, b, cu, cv, band)
		if (!fit) return null

		const moved = Math.hypot(fit.cu - cu, fit.cv - cv)
		cu = fit.cu
		cv = fit.cv
		radius = fit.r
		if (pass >= 6 && moved < 1e-6) break
	}

	return radius > 1e-6 ? radius : null
}

/**
 * Подгонка окружности по точкам (метод Каса): решает x²+y² = 2a·x + 2b·y + c
 * методом наименьших квадратов. В отличие от усреднения работает на неполной
 * дуге, что и нужно, пока центр ещё не найден.
 */
function fitCircle(
	pos: Float32Array,
	a: number,
	b: number,
	cu: number,
	cv: number,
	band: number,
): { cu: number; cv: number; r: number } | null {
	// Нормальные уравнения 3×3
	let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0
	let sxz = 0, syz = 0, sz = 0

	for (let i = 0; i < pos.length; i += 3) {
		const x = pos[i + a] - cu
		const y = pos[i + b] - cv
		if (Math.hypot(x, y) > band) continue
		const z = x * x + y * y
		sxx += x * x; sxy += x * y; sx += x
		syy += y * y; sy += y
		sxz += x * z; syz += y * z; sz += z
		n++
	}
	if (n < 8) return null

	// A·[a b c]ᵀ = rhs, где строки исходной системы — [2x, 2y, 1]
	const A = [
		[2 * sxx, 2 * sxy, sx],
		[2 * sxy, 2 * syy, sy],
		[2 * sx, 2 * sy, n],
	]
	const rhs = [sxz, syz, sz]

	// Гаусс с выбором ведущего элемента
	for (let col = 0; col < 3; col++) {
		let pivot = col
		for (let row = col + 1; row < 3; row++) {
			if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row
		}
		if (Math.abs(A[pivot][col]) < 1e-12) return null
		if (pivot !== col) {
			;[A[col], A[pivot]] = [A[pivot], A[col]]
			;[rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]]
		}
		for (let row = col + 1; row < 3; row++) {
			const f = A[row][col] / A[col][col]
			for (let k = col; k < 3; k++) A[row][k] -= f * A[col][k]
			rhs[row] -= f * rhs[col]
		}
	}
	const sol = [0, 0, 0]
	for (let row = 2; row >= 0; row--) {
		let acc = rhs[row]
		for (let k = row + 1; k < 3; k++) acc -= A[row][k] * sol[k]
		sol[row] = acc / A[row][row]
	}

	const [da, db, c] = sol
	const rSq = c + da * da + db * db
	if (!(rSq > 0)) return null

	return { cu: cu + da, cv: cv + db, r: Math.sqrt(rSq) }
}

export interface StlExportResult {
	blob: Blob
	filename: string
	audit: MeshAudit
	/** Сколько миллиметров в одной единице сцены */
	mmPerUnit: number
}

export function encodeBinarySTL(pos: Float32Array): ArrayBuffer {
	const triCount = pos.length / 9
	const buffer = new ArrayBuffer(84 + triCount * 50)
	const view = new DataView(buffer)

	// 80-байтовый заголовок: подпись, дальше нули
	const header = 'Favplace ring export (mm)'
	for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i))

	let written = 0
	let offset = 84

	for (let t = 0; t < triCount; t++) {
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
		// Вырожденные грани в файл не пишем — слайсеры на них ругаются
		if (len < 1e-9) continue
		nx /= len; ny /= len; nz /= len

		view.setFloat32(offset, nx, true); offset += 4
		view.setFloat32(offset, ny, true); offset += 4
		view.setFloat32(offset, nz, true); offset += 4

		for (const c of [ax, ay, az, bx, by, bz, cx, cy, cz]) {
			view.setFloat32(offset, c, true)
			offset += 4
		}
		view.setUint16(offset, 0, true); offset += 2
		written++
	}

	view.setUint32(80, written, true)
	// Обрезаем хвост, оставшийся от выброшенных вырожденных граней
	return buffer.slice(0, 84 + written * 50)
}

export interface StlExportOptions {
	/** Внутренний диаметр шинки, мм — задаёт физический масштаб */
	ringSizeMm: number
	filename?: string
}

export function buildStlExport(
	root: THREE.Object3D,
	{ ringSizeMm, filename = 'favplace-ring.stl' }: StlExportOptions,
): StlExportResult {
	const raw = collectTriangles(root)
	if (raw.length === 0) {
		throw new Error('В сцене нет геометрии для экспорта')
	}

	const bore = measureBoreRadius(raw)
	if (!bore) {
		throw new Error('Не удалось измерить посадочное отверстие — масштаб неизвестен')
	}

	const mmPerUnit = ringSizeMm / 2 / bore
	const scaled = new Float32Array(raw.length)
	for (let i = 0; i < raw.length; i++) scaled[i] = raw[i] * mmPerUnit

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(scaled, 3))

	const audit = auditMesh(geometry)
	const blob = new Blob([encodeBinarySTL(scaled)], { type: 'model/stl' })

	geometry.dispose()

	return { blob, filename, audit, mmPerUnit }
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	// Освобождаем после того, как браузер забрал файл
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
