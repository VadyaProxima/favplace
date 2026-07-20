import * as THREE from 'three'

export const SIGNET_GLB_PATH = '/models/lion_signate_ring.glb'

const INSERT_MESH_NAMES = /^Object_3$/i

type LoadedGltf = { scene: THREE.Group }

export type SignetMaterialProps = {
	color: string
	metalness: number
	roughness: number
	polished: boolean
}

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

function sampleHeightMap(hm: number[][] | null, u: number, v: number) {
	if (!hm?.length) return 0
	const hmH = hm.length
	const hmW = hm[0]?.length ?? 0
	if (!hmW) return 0
	const fx = clamp01(u) * (hmW - 1)
	const fy = clamp01(v) * (hmH - 1)
	const x0 = Math.floor(fx)
	const y0 = Math.floor(fy)
	const x1 = Math.min(x0 + 1, hmW - 1)
	const y1 = Math.min(y0 + 1, hmH - 1)
	const tx = fx - x0
	const ty = fy - y0
	const v00 = hm[y0]?.[x0] ?? 0
	const v10 = hm[y0]?.[x1] ?? 0
	const v01 = hm[y1]?.[x0] ?? 0
	const v11 = hm[y1]?.[x1] ?? 0
	const val =
		v00 * (1 - tx) * (1 - ty) +
		v10 * tx * (1 - ty) +
		v01 * (1 - tx) * ty +
		v11 * tx * ty
	return Number.isFinite(val) ? val : 0
}

const RELIEF_COVER_SCALE = 1.4

function makeRingMaterial(props: SignetMaterialProps) {
	return new THREE.MeshPhysicalMaterial({
		color: props.color,
		metalness: props.metalness,
		roughness: props.roughness,
		transparent: false,
		opacity: 1,
		depthWrite: true,
		side: THREE.FrontSide,
		envMapIntensity: props.polished ? 1.55 : 1.1,
		clearcoat: props.polished ? 0.45 : 0.05,
		clearcoatRoughness: 0.08,
		reflectivity: 1,
		sheen: props.polished ? 0.15 : 0,
		sheenRoughness: 0.35,
		sheenColor: new THREE.Color('#ffffff'),
	})
}

/** Запечь мировые координаты, выкинуть иерархию Sketchfab (rotation −90°) */
function flattenToMeshGroup(source: THREE.Object3D): THREE.Group {
	const group = new THREE.Group()
	source.updateMatrixWorld(true)

	source.traverse(obj => {
		if (!(obj instanceof THREE.Mesh)) return
		obj.updateMatrixWorld(true)
		const geom = obj.geometry.clone()
		geom.applyMatrix4(obj.matrixWorld)
		const mesh = new THREE.Mesh(geom, obj.material)
		mesh.name = obj.name
		group.add(mesh)
	})

	return group
}

function collectInsertMeshes(meshes: THREE.Mesh[]) {
	return meshes.filter(m => INSERT_MESH_NAMES.test(m.name))
}

function meshBox(mesh: THREE.Mesh) {
	const box = new THREE.Box3()
	const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
	if (pos) box.setFromBufferAttribute(pos)
	return box
}

function insertFrame(recess: THREE.Box3) {
	const cx = (recess.min.x + recess.max.x) / 2
	const cz = (recess.min.z + recess.max.z) / 2
	const rx = (recess.max.x - recess.min.x) / 2
	const rz = (recess.max.z - recess.min.z) / 2
	const tableY = recess.max.y
	return { cx, cz, rx, rz, tableY }
}

function ellipseR(x: number, z: number, cx: number, cz: number, rx: number, rz: number) {
	const dx = (x - cx) / rx
	const dz = (z - cz) / rz
	return Math.sqrt(dx * dx + dz * dz)
}

function inInsertEllipse(
	x: number,
	y: number,
	z: number,
	recess: THREE.Box3,
	cover = RELIEF_COVER_SCALE,
) {
	const { cx, cz, rx, rz, tableY } = insertFrame(recess)
	return (
		y >= recess.min.y &&
		y <= tableY + 0.05 &&
		ellipseR(x, z, cx, cz, rx * cover, rz * cover) <= 1
	)
}

/**
 * Заполнить карман под льва в корпусе — только внутри овала вставки.
 */
function fillInsertPocket(mesh: THREE.Mesh, recess: THREE.Box3) {
	const geom = mesh.geometry as THREE.BufferGeometry
	const pos = geom.getAttribute('position') as THREE.BufferAttribute
	if (!pos) return

	const { tableY } = insertFrame(recess)
	const span = Math.max(
		recess.max.x - recess.min.x,
		recess.max.z - recess.min.z,
	)
	const sinkY = tableY - span * 0.004

	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i)
		const y = pos.getY(i)
		const z = pos.getZ(i)
		if (inInsertEllipse(x, y, z, recess)) {
			pos.setY(i, sinkY)
		}
	}
	pos.needsUpdate = true
	geom.computeVertexNormals()
}

type ReliefVertex = { x: number; y: number; z: number }

function triNormal(
	positions: number[],
	ai: number,
	bi: number,
	ci: number,
) {
	const ax = positions[ai * 3]
	const ay = positions[ai * 3 + 1]
	const az = positions[ai * 3 + 2]
	const bx = positions[bi * 3]
	const by = positions[bi * 3 + 1]
	const bz = positions[bi * 3 + 2]
	const cx = positions[ci * 3]
	const cy = positions[ci * 3 + 1]
	const cz = positions[ci * 3 + 2]
	const ux = bx - ax
	const uy = by - ay
	const uz = bz - az
	const vx = cx - ax
	const vy = cy - ay
	const vz = cz - az
	return {
		x: uy * vz - uz * vy,
		y: uz * vx - ux * vz,
		z: ux * vy - uy * vx,
	}
}

/** Верхняя грань + боковые стенки по контуру овала (без дна — не просвечивает сверху) */
function buildReliefGeometry(
	recess: THREE.Box3,
	heightMap: number[][] | null,
	reliefHeight: number,
) {
	const { cx, cz, rx, rz, tableY } = insertFrame(recess)
	const reliefRx = rx * RELIEF_COVER_SCALE
	const reliefRz = rz * RELIEF_COVER_SCALE
	const span = Math.max(
		recess.max.x - recess.min.x,
		recess.max.z - recess.min.z,
	)
	const emboss = span * 0.1 * reliefHeight
	const floorY = tableY + span * 0.001
	const segments = 140

	const topVerts: ReliefVertex[] = []
	const grid: (number | null)[][] = []

	for (let j = 0; j <= segments; j++) {
		const row: (number | null)[] = []
		const nz = (j / segments) * 2 - 1

		for (let i = 0; i <= segments; i++) {
			const nx = (i / segments) * 2 - 1
			const rNorm = Math.sqrt(nx * nx + nz * nz)
			if (rNorm > 1) {
				row.push(null)
				continue
			}

			const x = cx + nx * reliefRx
			const z = cz + nz * reliefRz
			const u = clamp01((nx + 1) * 0.5)
			const v = clamp01(1 - (nz + 1) * 0.5)
			const h = sampleHeightMap(heightMap, u, v)
			const y = floorY + h * emboss

			row.push(topVerts.length)
			topVerts.push({ x, y, z })
		}
		grid.push(row)
	}

	const positions: number[] = []
	const indices: number[] = []

	for (const v of topVerts) positions.push(v.x, v.y, v.z)

	const bottomStart = topVerts.length
	for (const v of topVerts) positions.push(v.x, floorY, v.z)

	const addOutwardWall = (topA: number, topB: number) => {
		const botA = bottomStart + topA
		const botB = bottomStart + topB
		const mx = (positions[topA * 3] + positions[topB * 3]) * 0.5 - cx
		const mz = (positions[topA * 3 + 2] + positions[topB * 3 + 2]) * 0.5 - cz

		const n = triNormal(positions, topA, topB, botB)
		const dot = n.x * mx + n.z * mz
		if (dot < 0) {
			indices.push(topA, botB, topB, topA, botA, botB)
		} else {
			indices.push(topA, topB, botB, topA, botB, botA)
		}
	}

	const wallEdges = new Set<string>()
	const addWall = (a: number, b: number) => {
		const key = a < b ? `${a}:${b}` : `${b}:${a}`
		if (wallEdges.has(key)) return
		wallEdges.add(key)
		addOutwardWall(a, b)
	}

	for (let j = 0; j < segments; j++) {
		for (let i = 0; i < segments; i++) {
			const a = grid[j][i]
			const b = grid[j][i + 1]
			const c = grid[j + 1][i]
			const d = grid[j + 1][i + 1]
			if (a == null || b == null || c == null) continue
			indices.push(a, c, b)
			if (d == null) continue
			indices.push(b, c, d)
		}
	}

	for (let j = 0; j <= segments; j++) {
		for (let i = 0; i < segments; i++) {
			const a = grid[j]?.[i]
			const b = grid[j]?.[i + 1]
			if (a == null || b == null) continue

			const holeAbove =
				j === 0 || grid[j - 1]?.[i] == null || grid[j - 1]?.[i + 1] == null
			const holeBelow =
				j === segments ||
				grid[j + 1]?.[i] == null ||
				grid[j + 1]?.[i + 1] == null
			if (holeAbove !== holeBelow) addWall(a, b)
		}
	}

	for (let j = 0; j < segments; j++) {
		for (let i = 0; i <= segments; i++) {
			const a = grid[j]?.[i]
			const b = grid[j + 1]?.[i]
			if (a == null || b == null) continue

			const holeLeft =
				i === 0 || grid[j]?.[i - 1] == null || grid[j + 1]?.[i - 1] == null
			const holeRight =
				i === segments ||
				grid[j]?.[i + 1] == null ||
				grid[j + 1]?.[i + 1] == null
			if (holeLeft !== holeRight) addWall(a, b)
		}
	}

	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geo.setIndex(indices)
	geo.computeVertexNormals()
	return geo
}

/** Верхняя грань DEM-рельефа на овальной вставке */
function buildReliefMesh(
	recess: THREE.Box3,
	heightMap: number[][] | null,
	reliefHeight: number,
	materialProps: SignetMaterialProps,
) {
	const geo = buildReliefGeometry(recess, heightMap, reliefHeight)
	const mesh = new THREE.Mesh(geo, makeRingMaterial(materialProps))
	mesh.name = 'terrain-relief'
	mesh.castShadow = true
	mesh.receiveShadow = true
	return mesh
}

function positionForViewer(root: THREE.Group) {
	root.updateMatrixWorld(true)
	const box = new THREE.Box3().setFromObject(root)
	const size = box.getSize(new THREE.Vector3())
	const scale = 2.05 / Math.max(size.x, size.y, size.z)
	root.scale.setScalar(scale)

	root.updateMatrixWorld(true)
	const box2 = new THREE.Box3().setFromObject(root)
	const center = box2.getCenter(new THREE.Vector3())
	root.position.set(-center.x, 0.55 - center.y, -center.z)
}

export function prepareSignetFromGlb(
	gltf: LoadedGltf,
	heightMap: number[][] | null,
	reliefHeight: number,
	materialProps: SignetMaterialProps,
): THREE.Group {
	const root = new THREE.Group()
	const flat = flattenToMeshGroup(gltf.scene)
	root.add(flat)

	const meshes: THREE.Mesh[] = []
	flat.traverse(obj => {
		if (obj instanceof THREE.Mesh) meshes.push(obj)
	})

	const inserts = collectInsertMeshes(meshes)
	const recess = new THREE.Box3()
	for (const insert of inserts) {
		recess.union(meshBox(insert))
		insert.parent?.remove(insert)
		insert.geometry.dispose()
		if (insert.material instanceof THREE.Material) {
			const mats = Array.isArray(insert.material) ? insert.material : [insert.material]
			for (const m of mats) m.dispose()
		}
	}

	const bodyMeshes = meshes.filter(m => !inserts.includes(m))
	const ringMat = makeRingMaterial(materialProps)

	if (!recess.isEmpty() && bodyMeshes.length > 0) {
		const body = bodyMeshes[0]
		body.geometry = body.geometry.clone()
		fillInsertPocket(body, recess)

		const relief = buildReliefMesh(recess, heightMap, reliefHeight, materialProps)
		root.add(relief)

		body.material = ringMat
		body.castShadow = true
		body.receiveShadow = true
	} else {
		for (const body of bodyMeshes) {
			body.material = ringMat
			body.castShadow = true
			body.receiveShadow = true
		}
	}

	positionForViewer(root)
	return root
}

export function getRingBottomY(root: THREE.Object3D) {
	const box = new THREE.Box3().setFromObject(root)
	return box.min.y
}
