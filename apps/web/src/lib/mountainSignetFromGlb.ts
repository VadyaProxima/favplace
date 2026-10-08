import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

import { makeJewelleryMaterial } from './jewelleryMaterial.ts'
import { buildReliefSurfaceData } from './mountainReliefMath.ts'
import { sculptReliefHeight } from './reliefSculpt.ts'

export const MOUNTAIN_SIGNET_GLB_PATH = '/models/mountain_signet_body.glb'

const BODY_NODE = 'RING_BODY'
const SOCKET_NODE = 'RELIEF_SOCKET'
const GRID_ROWS = 160
const GRID_COLS = 168
const EDGE_FADE = 0.18
const SUPERELLIPSE_POWER = 4
const TARGET_SIZE = 1.55
const TARGET_CENTER_Y = 0.55

interface MaterialOptions {
	color: string
	metalness: number
	roughness: number
	polished: boolean
	twoTone: boolean
}

export interface PreparedMountainSignet {
	root: THREE.Group
	bottomY: number
	dispose: () => void
}

function requireMesh(root: THREE.Object3D, name: string): THREE.Mesh {
	const object = root.getObjectByName(name)
	if (!(object instanceof THREE.Mesh)) {
		throw new Error(`Mountain signet GLB is missing mesh ${name}`)
	}
	return object
}

function reliefAmplitude(reliefHeight: number, socketSize: THREE.Vector3): number {
	const shortestSide = Math.max(1e-6, Math.min(socketSize.x, socketSize.z))
	const slider = Math.min(3, Math.max(0.4, reliefHeight))
	return shortestSide * (0.035 + slider * 0.04)
}

function buildReliefGeometry(
	heightMap: number[][],
	socketBounds: THREE.Box3,
	reliefHeight: number,
): THREE.BufferGeometry {
	const socketSize = socketBounds.getSize(new THREE.Vector3())
	const socketCenter = socketBounds.getCenter(new THREE.Vector3())
	const sculpted = heightMap.map(row => row.map(sculptReliefHeight))
	const surface = buildReliefSurfaceData(sculpted, {
		length: socketSize.x,
		width: socketSize.z,
		baseY: socketBounds.max.y + 0.000025,
		amplitude: reliefAmplitude(reliefHeight, socketSize),
		rows: GRID_ROWS,
		cols: GRID_COLS,
		edgeFade: EDGE_FADE,
		power: SUPERELLIPSE_POWER,
	})

	for (let index = 0; index < surface.positions.length; index += 3) {
		surface.positions[index] += socketCenter.x
		surface.positions[index + 2] += socketCenter.z
	}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(surface.positions, 3))
	geometry.setIndex(new THREE.BufferAttribute(surface.indices, 1))
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}

export function prepareMountainSignetFromGlb(
	gltf: Pick<GLTF, 'scene'>,
	heightMap: number[][],
	reliefHeight: number,
	material: MaterialOptions,
): PreparedMountainSignet {
	const root = gltf.scene.clone(true) as THREE.Group
	root.name = 'MountainSignetRuntime'
	root.updateMatrixWorld(true)

	const body = requireMesh(root, BODY_NODE)
	const socket = requireMesh(root, SOCKET_NODE)
	const socketBounds = new THREE.Box3().setFromObject(socket)
	if (socketBounds.isEmpty()) {
		throw new Error('RELIEF_SOCKET has empty bounds')
	}

	const ownedGeometries: THREE.BufferGeometry[] = []
	const ownedMaterials: THREE.Material[] = []
	const bodyGeometry = body.geometry.clone()
	body.geometry = bodyGeometry
	ownedGeometries.push(bodyGeometry)

	const bandMaterial = makeJewelleryMaterial({
		color: material.color,
		metalness: material.metalness,
		roughness: material.roughness,
		polished: material.polished,
		variant: 'band',
	})
	body.material = bandMaterial
	body.castShadow = true
	body.receiveShadow = true
	ownedMaterials.push(bandMaterial)

	socket.visible = false
	socket.castShadow = false
	socket.receiveShadow = false

	const reliefGeometry = buildReliefGeometry(heightMap, socketBounds, reliefHeight)
	const reliefMaterial = makeJewelleryMaterial({
		color: material.color,
		metalness: material.metalness,
		roughness: material.roughness,
		polished: material.polished,
		variant: material.twoTone ? 'frost' : 'terrain',
	})
	const relief = new THREE.Mesh(reliefGeometry, reliefMaterial)
	relief.name = 'TERRAIN_RELIEF'
	relief.castShadow = true
	relief.receiveShadow = true
	root.add(relief)
	ownedGeometries.push(reliefGeometry)
	ownedMaterials.push(reliefMaterial)

	root.updateMatrixWorld(true)
	const sourceBox = new THREE.Box3().setFromObject(root)
	const sourceSize = sourceBox.getSize(new THREE.Vector3())
	const scale = TARGET_SIZE / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 1e-6)
	root.scale.setScalar(scale)
	root.updateMatrixWorld(true)

	const scaledBox = new THREE.Box3().setFromObject(root)
	const center = scaledBox.getCenter(new THREE.Vector3())
	root.position.set(-center.x, TARGET_CENTER_Y - center.y, -center.z)
	root.updateMatrixWorld(true)
	const finalBox = new THREE.Box3().setFromObject(root)

	return {
		root,
		bottomY: finalBox.min.y,
		dispose: () => {
			for (const geometry of ownedGeometries) geometry.dispose()
			for (const ownedMaterial of ownedMaterials) ownedMaterial.dispose()
		},
	}
}
