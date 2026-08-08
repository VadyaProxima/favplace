import * as THREE from 'three'
import { embossAmplitude, sculptReliefHeight } from './reliefSculpt'

export const BASIC_RING_GLB_PATH = '/models/basic_ring.glb'

/** Which empty face from basic_ring.glb */
export type BasicRingVariant = 'square' | 'circle' | 'oval'

/**
 * Mesh mapping from GLB inspect:
 * Object_2 — rounded square, Object_1 — circle, Object_0 — elongated oval
 */
const VARIANT_MESH: Record<BasicRingVariant, RegExp> = {
	square: /^Object_8$|^Object_2$/i,
	circle: /^Object_6$|^Object_1$/i,
	oval: /^Object_4$|^Object_0$/i,
}

type LoadedGltf = { scene: THREE.Group }

export type BasicRingMaterialProps = {
	color: string
	metalness: number
	roughness: number
	polished: boolean
}

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

function smootherstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * t * (t * (t * 6 - 15) + 10)
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
	return (
		(hm[y0]?.[x0] ?? 0) * (1 - tx) * (1 - ty) +
		(hm[y0]?.[x1] ?? 0) * tx * (1 - ty) +
		(hm[y1]?.[x0] ?? 0) * (1 - tx) * ty +
		(hm[y1]?.[x1] ?? 0) * tx * ty
	)
}

function makeRingMaterial(props: BasicRingMaterialProps, forRelief = false) {
	const mat = new THREE.MeshStandardMaterial({
		color: props.color,
		metalness: props.metalness,
		roughness: props.roughness,
		envMapIntensity: props.polished ? 1.55 : 1.0,
		transparent: false,
		opacity: 1,
		depthWrite: true,
		depthTest: true,
		side: THREE.FrontSide,
		alphaTest: 0,
		polygonOffset: forRelief,
		polygonOffsetFactor: forRelief ? -1 : 0,
		polygonOffsetUnits: forRelief ? -1 : 0,
	})
	mat.blending = THREE.NormalBlending
	mat.needsUpdate = true
	return mat
}

function flattenMeshes(source: THREE.Object3D): THREE.Mesh[] {
	source.updateMatrixWorld(true)
	const out: THREE.Mesh[] = []
	source.traverse(obj => {
		if (!(obj instanceof THREE.Mesh)) return
		obj.updateMatrixWorld(true)
		const geom = obj.geometry.clone()
		geom.applyMatrix4(obj.matrixWorld)
		const mesh = new THREE.Mesh(geom, obj.material)
		mesh.name = obj.name
		out.push(mesh)
	})
	return out
}

/** Slight oversize so relief seals into the insert edge (no shelf). */
const RELIEF_COVER = 1.02
/** Rounded-square corner as fraction of half-extent (matches basic_ring.glb). */
const SQUARE_CORNER = 0.35

type TableFrame = {
	cx: number
	cz: number
	rx: number
	rz: number
	tableY: number
	sink: number
	shape: BasicRingVariant
}

/** Flat insert AABB from near-horizontal top verts. */
function detectTable(geometry: THREE.BufferGeometry, shape: BasicRingVariant): TableFrame {
	geometry.computeBoundingBox()
	geometry.computeVertexNormals()
	const pos = geometry.getAttribute('position') as THREE.BufferAttribute
	const nrm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
	const box = geometry.boundingBox!
	const maxY = box.max.y
	const height = Math.max(1e-6, box.max.y - box.min.y)
	const yBand = Math.max(0.01, height * 0.015)

	const xs: number[] = []
	const zs: number[] = []
	const ys: number[] = []
	for (let i = 0; i < pos.count; i++) {
		const y = pos.getY(i)
		if (y < maxY - yBand) continue
		if (nrm && nrm.getY(i) < 0.8) continue
		xs.push(pos.getX(i))
		zs.push(pos.getZ(i))
		ys.push(y)
	}

	if (xs.length < 8) {
		const cx = (box.min.x + box.max.x) / 2
		const cz = (box.min.z + box.max.z) / 2
		const rx = (box.max.x - box.min.x) * 0.4
		const rz = (box.max.z - box.min.z) * 0.4
		const span = Math.max(rx, rz) * 2
		return { cx, cz, rx, rz, tableY: maxY, sink: span * 0.004, shape }
	}

	let minX = Infinity
	let maxX = -Infinity
	let minZ = Infinity
	let maxZ = -Infinity
	for (let i = 0; i < xs.length; i++) {
		minX = Math.min(minX, xs[i])
		maxX = Math.max(maxX, xs[i])
		minZ = Math.min(minZ, zs[i])
		maxZ = Math.max(maxZ, zs[i])
	}
	const cx = (minX + maxX) / 2
	const cz = (minZ + maxZ) / 2
	let rx = ((maxX - minX) / 2) * RELIEF_COVER
	let rz = ((maxZ - minZ) / 2) * RELIEF_COVER
	ys.sort((a, b) => a - b)
	const tableY = ys[Math.floor(ys.length * 0.5)]

	if (shape === 'circle') {
		const r = Math.max(rx, rz)
		rx = r
		rz = r
	}

	const span = Math.max(rx, rz) * 2
	return { cx, cz, rx, rz, tableY, sink: span * 0.004, shape }
}

/** Clean parametric outline — never sample a noisy polar silhouette (that made the “star”). */
function shapeRimRadius(frame: TableFrame, angle: number): number {
	const c = Math.cos(angle)
	const s = Math.sin(angle)
	if (frame.shape === 'square') {
		const corner = SQUARE_CORNER
		const ax = Math.abs(c)
		const az = Math.abs(s)
		const scale = 1 / Math.max(ax, az, 1e-6)
		let nx = c * scale
		let nz = s * scale
		const mx = Math.abs(nx)
		const mz = Math.abs(nz)
		if (mx > 1 - corner && mz > 1 - corner) {
			const ox = Math.sign(nx) * (1 - corner)
			const oz = Math.sign(nz) * (1 - corner)
			const ang = Math.atan2(nz - oz, nx - ox)
			nx = ox + Math.cos(ang) * corner
			nz = oz + Math.sin(ang) * corner
		}
		return Math.hypot(nx * frame.rx, nz * frame.rz)
	}
	const den = Math.hypot(c * frame.rz, s * frame.rx)
	if (den < 1e-9) return Math.min(frame.rx, frame.rz)
	return (frame.rx * frame.rz) / den
}

/**
 * Normalized distance to rim in shape-space is handled inside shapeFade.
 * 1 inside, 0 outside. Narrow lip — mountains almost to the edge.
 */
function shapeFade(nx: number, nz: number, shape: BasicRingVariant): number {
	if (shape === 'square') {
		const corner = SQUARE_CORNER
		const ax = Math.abs(nx)
		const az = Math.abs(nz)
		if (ax > 1 || az > 1) return 0
		const m = Math.max(ax, az)
		const inner = 1 - corner
		if (m <= inner) {
			return 1 - smootherstep(0.94, 0.999, m)
		}
		const cx = Math.max(0, ax - inner)
		const cz = Math.max(0, az - inner)
		const cr = Math.hypot(cx / corner, cz / corner)
		if (cr >= 1) return 0
		return 1 - smootherstep(0.9, 0.999, cr)
	}
	const r = Math.hypot(nx, nz)
	if (r > 1) return 0
	return 1 - smootherstep(0.94, 0.999, r)
}

/**
 * Disc-style seating: valleys lie ON the sunk insert (no floating collar).
 * Perimeter wall digs into the pocket so the side junction is solid.
 */
function buildReliefGeometry(
	frame: TableFrame,
	heightMap: number[][] | null,
	reliefHeight: number,
): THREE.BufferGeometry {
	const { cx, cz, rx, rz, tableY, sink, shape } = frame
	const span = Math.max(rx * 2, rz * 2)
	const embossAmp = embossAmplitude(reliefHeight) * Math.max(span * 0.85, 0.35)
	const pocketY = tableY - sink
	// Sit in the pocket (tiny bite below) so side views show no air gap
	const floorY = pocketY - span * 0.0004
	const segments = 200
	const rimSegs = 256

	type V = { x: number; y: number; z: number }
	const topVerts: V[] = []
	const grid: (number | null)[][] = []

	for (let j = 0; j <= segments; j++) {
		const row: (number | null)[] = []
		const nz = (j / segments) * 2 - 1
		for (let i = 0; i <= segments; i++) {
			const nx = (i / segments) * 2 - 1
			const fade = shapeFade(nx, nz, shape)
			if (fade <= 0) {
				row.push(null)
				continue
			}
			const x = cx + nx * rx
			const z = cz + nz * rz
			const u = clamp01((nx + 1) * 0.5)
			const v = clamp01(1 - (nz + 1) * 0.5)
			const h = sculptReliefHeight(sampleHeightMap(heightMap, u, v))
			// At the rim fade→0 ⇒ y→floorY ⇒ flush with the insert
			const y = floorY + h * embossAmp * fade
			row.push(topVerts.length)
			topVerts.push({ x, y, z })
		}
		grid.push(row)
	}

	const positions: number[] = []
	const indices: number[] = []
	for (const p of topVerts) positions.push(p.x, p.y, p.z)

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
	const topTriCount = indices.length / 3

	// Bottom on the insert plane — closes underside
	const bottomStart = positions.length / 3
	for (const p of topVerts) positions.push(p.x, floorY, p.z)
	for (let t = 0; t < topTriCount; t++) {
		const a = indices[t * 3]
		const b = indices[t * 3 + 1]
		const c = indices[t * 3 + 2]
		indices.push(bottomStart + a, bottomStart + c, bottomStart + b)
	}

	// Smooth parametric outer wall dug into the pocket
	const wallBotY = pocketY - span * 0.002
	const rimTop = positions.length / 3
	for (let i = 0; i < rimSegs; i++) {
		const a = (i / rimSegs) * Math.PI * 2
		const r = shapeRimRadius(frame, a)
		positions.push(cx + Math.cos(a) * r, floorY, cz + Math.sin(a) * r)
	}
	const rimBot = positions.length / 3
	for (let i = 0; i < rimSegs; i++) {
		const a = (i / rimSegs) * Math.PI * 2
		const r = shapeRimRadius(frame, a)
		positions.push(cx + Math.cos(a) * r, wallBotY, cz + Math.sin(a) * r)
	}
	for (let i = 0; i < rimSegs; i++) {
		const i2 = (i + 1) % rimSegs
		indices.push(
			rimTop + i,
			rimBot + i2,
			rimTop + i2,
			rimTop + i,
			rimBot + i,
			rimBot + i2,
		)
	}

	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
	geo.setIndex(indices)
	geo.computeVertexNormals()
	return geo
}

/** Recess insert — pocket under the relief (classic fillInsertPocket). */
function sinkTableFace(geometry: THREE.BufferGeometry, frame: TableFrame) {
	const pos = geometry.getAttribute('position') as THREE.BufferAttribute
	const eps = Math.max(0.003, Math.min(frame.rx, frame.rz) * 0.012)
	const pocketY = frame.tableY - frame.sink
	for (let i = 0; i < pos.count; i++) {
		const y = pos.getY(i)
		if (y < frame.tableY - eps) continue
		const nx = (pos.getX(i) - frame.cx) / (frame.rx || 1)
		const nz = (pos.getZ(i) - frame.cz) / (frame.rz || 1)
		if (shapeFade(nx, nz, frame.shape) > 0.02) {
			pos.setY(i, pocketY)
		}
	}
	pos.needsUpdate = true
	geometry.computeVertexNormals()
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

function pickMesh(meshes: THREE.Mesh[], variant: BasicRingVariant): THREE.Mesh {
	const re = VARIANT_MESH[variant]
	const hit = meshes.find(m => re.test(m.name))
	if (hit) return hit
	const scored = meshes.map(m => {
		m.geometry.computeBoundingBox()
		const b = m.geometry.boundingBox!
		const w = b.max.x - b.min.x
		const d = b.max.z - b.min.z
		const aspect = Math.max(w, d) / Math.max(1e-6, Math.min(w, d))
		return { m, aspect }
	})
	if (variant === 'circle') {
		return scored.sort((a, b) => a.aspect - b.aspect)[0].m
	}
	if (variant === 'oval') {
		return scored.sort((a, b) => b.aspect - a.aspect)[0].m
	}
	return scored.sort((a, b) => Math.abs(a.aspect - 1.3) - Math.abs(b.aspect - 1.3))[0].m
}

export function prepareBasicRingFromGlb(
	gltf: LoadedGltf,
	variant: BasicRingVariant,
	heightMap: number[][] | null,
	reliefHeight: number,
	materialProps: BasicRingMaterialProps,
): THREE.Group {
	const root = new THREE.Group()
	const all = flattenMeshes(gltf.scene)
	const body = pickMesh(all, variant)
	body.geometry = body.geometry.clone()
	body.geometry.computeBoundingBox()

	const frame = detectTable(body.geometry, variant)
	sinkTableFace(body.geometry, frame)

	const mat = makeRingMaterial(materialProps)
	body.material = mat
	body.castShadow = true
	body.receiveShadow = true
	root.add(body)

	const reliefGeo = buildReliefGeometry(frame, heightMap, reliefHeight)
	const relief = new THREE.Mesh(reliefGeo, makeRingMaterial(materialProps, true))
	relief.name = 'terrain-relief'
	relief.castShadow = true
	relief.receiveShadow = true
	root.add(relief)

	positionForViewer(root)
	return root
}

export function getBasicRingBottomY(root: THREE.Object3D) {
	const box = new THREE.Box3().setFromObject(root)
	return box.min.y
}

export function isBasicRingForm(
	form: string,
): form is BasicRingVariant {
	return form === 'square' || form === 'circle' || form === 'oval'
}
