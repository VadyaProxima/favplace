import * as THREE from 'three'
import {
	buildCushionReliefSurfaceData,
	reliefEmbeddingForTable,
	TERRAIN_CONTEXT_SCALE,
} from './basicReliefSurface.ts'

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
		flatShading: forRelief,
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

/** Rounded-square corner as fraction of half-extent (matches basic_ring.glb). */
const SQUARE_CORNER = 0.35

type TableFrame = {
	cx: number
	cz: number
	rx: number
	rz: number
	outerRx: number
	outerRz: number
	shoulderDrop: number
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
		return {
			cx,
			cz,
			rx,
			rz,
			outerRx: rx * 1.18,
			outerRz: rz * 1.18,
			shoulderDrop: Math.min(rx, rz) * 0.26,
			tableY: maxY,
			sink: span * 0.004,
			shape,
		}
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
	let rx = (maxX - minX) / 2
	let rz = (maxZ - minZ) / 2
	ys.sort((a, b) => a - b)
	const tableY = ys[Math.floor(ys.length * 0.5)]

	if (shape === 'circle') {
		const r = Math.max(rx, rz)
		rx = r
		rz = r
	}

	const shoulderDrop = Math.min(rx, rz) * 0.26
	let outerRx = rx
	let outerRz = rz
	for (let i = 0; i < pos.count; i++) {
		if (pos.getY(i) < tableY - shoulderDrop * 1.25) continue
		if (nrm && nrm.getY(i) < 0.15) continue
		outerRx = Math.max(outerRx, Math.abs(pos.getX(i) - cx))
		outerRz = Math.max(outerRz, Math.abs(pos.getZ(i) - cz))
	}
	outerRx = THREE.MathUtils.clamp(outerRx, rx * 1.04, rx * 1.35)
	outerRz = THREE.MathUtils.clamp(outerRz, rz * 1.04, rz * 1.45)
	if (shape === 'circle') {
		const outerR = Math.max(outerRx, outerRz)
		outerRx = outerR
		outerRz = outerR
	}

	const span = Math.max(rx, rz) * 2
	return {
		cx,
		cz,
		rx,
		rz,
		outerRx,
		outerRz,
		shoulderDrop,
		tableY,
		sink: span * 0.004,
		shape,
	}
}

/** Raised terrain: DEM zero sits on the untouched ring table and grows up. */
function buildReliefGeometry(
	frame: TableFrame,
	heightMap: number[][] | null,
	reliefHeight: number,
	reliefScale: number,
): THREE.BufferGeometry {
	const { cx, cz, rx, rz, tableY, shape, shoulderDrop } = frame
	const embedding = reliefEmbeddingForTable(
		Math.min(rx * 2, rz * 2),
		reliefHeight,
		reliefScale,
	)
	const relief = buildCushionReliefSurfaceData(heightMap ?? [], {
		cx,
		cz,
		rx: rx * 0.998,
		rz: rz * 0.998,
		innerRx: rx,
		innerRz: rz,
		baseY: tableY,
		amplitude: embedding.amplitude,
		heightMode: 'raised',
		boundarySeatStart: 1 / TERRAIN_CONTEXT_SCALE,
		shape,
		radialSegments: 256,
		angularSegments: 256,
		cornerRadius: SQUARE_CORNER,
		outerCornerRadius: SQUARE_CORNER,
		innerFootprintRatio: 1,
		edgeDrop: 0,
		fadeReliefOnShoulder: false,
		// Замыкаем вставку в тело: стенка от посаженного периметра вниз под
		// площадку и плоское дно. Уходит целиком внутрь корпуса кольца, зато
		// у меша появляется объём — без этого аудит видел 1024 граничных ребра,
		// а между вставкой и кольцом оставалась щель.
		//
		// backingDepth растёт вместе с амплитудой и на высоком рельефе пробил бы
		// шинку насквозь, поэтому не опускаемся ниже плеча площадки: рельеф
		// поднимается вверх от площадки, вниз стенке нужно ровно столько, чтобы
		// перекрыть неровность GLB под ободком.
		backingY: tableY - Math.min(embedding.backingDepth, shoulderDrop),
	})

	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.BufferAttribute(relief.positions, 3))
	geo.setIndex(new THREE.BufferAttribute(relief.indices, 1))
	geo.computeVertexNormals()
	geo.computeBoundingBox()
	geo.computeBoundingSphere()
	geo.userData.reliefBackingY = tableY - embedding.backingDepth
	geo.userData.reliefAmplitude = embedding.amplitude
	geo.userData.reliefOuterRx = rx * 0.998
	geo.userData.reliefOuterRz = rz * 0.998
	return geo
}

function positionForViewer(root: THREE.Group, anchor: THREE.Object3D) {
	root.updateMatrixWorld(true)
	const box = new THREE.Box3().setFromObject(anchor)
	const size = box.getSize(new THREE.Vector3())
	const scale = 2.05 / Math.max(size.x, size.y, size.z)
	root.scale.setScalar(scale)
	root.updateMatrixWorld(true)
	const box2 = new THREE.Box3().setFromObject(anchor)
	const center = box2.getCenter(new THREE.Vector3())
	root.position.set(-center.x, 0.55 - center.y, -center.z)
	root.updateMatrixWorld(true)
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
	reliefScale = 1,
): THREE.Group {
	const root = new THREE.Group()
	const all = flattenMeshes(gltf.scene)
	const body = pickMesh(all, variant)
	body.geometry = body.geometry.clone()
	body.geometry.computeBoundingBox()

	const frame = detectTable(body.geometry, variant)
	const reliefGeo = buildReliefGeometry(
		frame,
		heightMap,
		reliefHeight,
		reliefScale,
	)

	const mat = makeRingMaterial(materialProps)
	body.material = mat
	body.castShadow = true
	body.receiveShadow = true
	root.add(body)

	const relief = new THREE.Mesh(reliefGeo, makeRingMaterial(materialProps, true))
	relief.name = 'terrain-relief'
	relief.castShadow = true
	relief.receiveShadow = true
	root.add(relief)

	positionForViewer(root, body)
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
