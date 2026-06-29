import * as THREE from 'three'

export interface RingGeometryParams {
	ringRadius?: number
	tubeRadius?: number
	reliefHeight?: number
	tubularSegments?: number
}

export function buildRingBandGeometry(
	params: RingGeometryParams = {},
): THREE.BufferGeometry {
	const { ringRadius = 1, tubeRadius = 0.07, tubularSegments = 128 } = params
	return new THREE.TorusGeometry(ringRadius, tubeRadius, 64, tubularSegments)
}

export function buildTerrainInsertGeometry(
	heightMap: number[][],
	params: RingGeometryParams = {},
): THREE.BufferGeometry {
	const {
		ringRadius = 1,
		tubeRadius = 0.07,
		reliefHeight = 0.05,
		tubularSegments = 256,
	} = params

	const hmHeight = heightMap.length
	const hmWidth = heightMap[0]?.length ?? 1

	const insertHalfAngle = Math.PI / 6
	const radialSegments = 32
	const epsilon = 0.008

	const vertCount = (tubularSegments + 1) * (radialSegments + 1)
	const positions = new Float32Array(vertCount * 3)
	const normals = new Float32Array(vertCount * 3)
	const uvs = new Float32Array(vertCount * 2)

	let idx = 0
	for (let i = 0; i <= tubularSegments; i++) {
		const u = i / tubularSegments
		const theta = u * Math.PI * 2
		const cosT = Math.cos(theta)
		const sinT = Math.sin(theta)

		for (let j = 0; j <= radialSegments; j++) {
			const v = j / radialSegments
			const phi = -insertHalfAngle + v * 2 * insertHalfAngle
			const cosF = Math.cos(phi)
			const sinF = Math.sin(phi)

			const hmX = Math.min(Math.floor(u * hmWidth), hmWidth - 1)
			const hmRow = Math.min(Math.floor(v * (hmHeight - 1)), hmHeight - 1)
			const elevation = heightMap[hmRow][hmX]

			const displacement = elevation * reliefHeight
			const r = tubeRadius + epsilon + displacement

			const x = (ringRadius + r * cosF) * cosT
			const y = r * sinF
			const z = (ringRadius + r * cosF) * sinT

			positions[idx * 3] = x
			positions[idx * 3 + 1] = y
			positions[idx * 3 + 2] = z

			const nx = cosF * cosT
			const ny = sinF
			const nz = cosF * sinT
			normals[idx * 3] = nx
			normals[idx * 3 + 1] = ny
			normals[idx * 3 + 2] = nz

			uvs[idx * 2] = u
			uvs[idx * 2 + 1] = v

			idx++
		}
	}

	const indexCount = tubularSegments * radialSegments * 6
	const indices = new Uint32Array(indexCount)
	let triIdx = 0

	for (let i = 0; i < tubularSegments; i++) {
		for (let j = 0; j < radialSegments; j++) {
			const a = i * (radialSegments + 1) + j
			const b = a + 1
			const c = (i + 1) * (radialSegments + 1) + j
			const d = c + 1

			indices[triIdx++] = a
			indices[triIdx++] = c
			indices[triIdx++] = b
			indices[triIdx++] = b
			indices[triIdx++] = c
			indices[triIdx++] = d
		}
	}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	geometry.computeVertexNormals()

	return geometry
}
