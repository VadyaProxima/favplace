import * as THREE from 'three'

export interface PlateParams {
	ringRadius?: number
	tubeRadius?: number
	plateWidth?: number
	plateLength?: number
	plateThickness?: number
	reliefHeight?: number
	gridX?: number
	gridZ?: number
}

export function buildRingBand(
	ringRadius = 1,
	tubeRadius = 0.07,
): THREE.BufferGeometry {
	return new THREE.TorusGeometry(ringRadius, tubeRadius, 64, 128)
}

export function buildTerrainPlate(
	heightMap: number[][],
	params: PlateParams = {},
): THREE.BufferGeometry {
	const {
		ringRadius = 1,
		tubeRadius = 0.07,
		plateWidth = 0.14,
		plateLength = 0.45,
		plateThickness = 0.015,
		reliefHeight = 0.04,
		gridX = 64,
		gridZ = 128,
	} = params

	const hmH = heightMap.length
	const hmW = heightMap[0]?.length ?? 1

	const topY = tubeRadius + plateThickness
	const baseY = tubeRadius
	const centerX = ringRadius

	const vertCount = (gridX + 1) * (gridZ + 1) * 2
	const positions = new Float32Array(vertCount * 3)
	const normals = new Float32Array(vertCount * 3)
	const uvs = new Float32Array(vertCount * 2)

	let idx = 0

	for (let iz = 0; iz <= gridZ; iz++) {
		for (let ix = 0; ix <= gridX; ix++) {
			const u = ix / gridX
			const v = iz / gridZ

			const x = centerX - plateWidth / 2 + u * plateWidth
			const z = -plateLength / 2 + v * plateLength

			const hmCol = Math.min(Math.floor(u * hmW), hmW - 1)
			const hmRow = Math.min(Math.floor(v * hmH), hmH - 1)
			const elevation = heightMap[hmRow][hmCol]

			const y = topY + elevation * reliefHeight

			positions[idx * 3] = x
			positions[idx * 3 + 1] = y
			positions[idx * 3 + 2] = z
			normals[idx * 3] = 0
			normals[idx * 3 + 1] = 1
			normals[idx * 3 + 2] = 0
			uvs[idx * 2] = u
			uvs[idx * 2 + 1] = v
			idx++
		}
	}

	for (let iz = 0; iz <= gridZ; iz++) {
		for (let ix = 0; ix <= gridX; ix++) {
			const u = ix / gridX
			const v = iz / gridZ

			const x = centerX - plateWidth / 2 + u * plateWidth
			const z = -plateLength / 2 + v * plateLength

			positions[idx * 3] = x
			positions[idx * 3 + 1] = baseY
			positions[idx * 3 + 2] = z
			normals[idx * 3] = 0
			normals[idx * 3 + 1] = -1
			normals[idx * 3 + 2] = 0
			uvs[idx * 2] = u
			uvs[idx * 2 + 1] = v
			idx++
		}
	}

	const faceCount = gridX * gridZ * 2 * 2
	const indices = new Uint32Array(faceCount * 6)
	let triIdx = 0

	const rowSize = gridX + 1
	for (let iz = 0; iz < gridZ; iz++) {
		for (let ix = 0; ix < gridX; ix++) {
			const a = iz * rowSize + ix
			const b = a + 1
			const c = (iz + 1) * rowSize + ix
			const d = c + 1

			indices[triIdx++] = a
			indices[triIdx++] = c
			indices[triIdx++] = b
			indices[triIdx++] = b
			indices[triIdx++] = c
			indices[triIdx++] = d
		}
	}

	const bottomOffset = (gridX + 1) * (gridZ + 1)
	for (let iz = 0; iz < gridZ; iz++) {
		for (let ix = 0; ix < gridX; ix++) {
			const a = bottomOffset + iz * rowSize + ix
			const b = a + 1
			const c = bottomOffset + (iz + 1) * rowSize + ix
			const d = c + 1

			indices[triIdx++] = a
			indices[triIdx++] = b
			indices[triIdx++] = c
			indices[triIdx++] = b
			indices[triIdx++] = d
			indices[triIdx++] = c
		}
	}

	const sides = [
		{ start: 0, end: gridX, row: 0, dir: 1 },
		{ start: 0, end: gridX, row: gridZ, dir: -1 },
	]

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	geometry.computeVertexNormals()

	return geometry
}
