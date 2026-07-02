import * as THREE from 'three'

export interface ReliefPlateParams {
	/** X size of the plate */
	plateWidth?: number
	/** Z size of the plate */
	plateLength?: number
	/** thickness of the flat base slab */
	plateThickness?: number
	/** how high the terrain peaks rise above the plate */
	reliefHeight?: number
	/** plate top mesh resolution along X */
	gridX?: number
	/** plate top mesh resolution along Z */
	gridZ?: number
}

const DEFAULTS: Required<ReliefPlateParams> = {
	plateWidth: 2,
	plateLength: 2,
	plateThickness: 0.15,
	reliefHeight: 0.5,
	gridX: 160,
	gridZ: 160,
}

/**
 * Standalone flat plate (плато) with the terrain heightmap relief on its top
 * surface — a solid metal block whose top follows the DEM elevations.
 * Centered at the origin in X/Z, resting on y = 0.
 */
export function buildReliefPlate(
	heightMap: number[][],
	params: ReliefPlateParams = {},
): THREE.BufferGeometry {
	const p = { ...DEFAULTS, ...params }
	const { plateWidth, plateLength, plateThickness, reliefHeight, gridX, gridZ } = p

	const hmH = heightMap.length
	const hmW = heightMap[0]?.length ?? 1

	const halfW = plateWidth / 2
	const halfL = plateLength / 2
	const baseTop = plateThickness // top of the flat slab; relief rises from here

	const cols = gridX + 1
	const rows = gridZ + 1
	const gridVerts = cols * rows

	// 2 grid layers (relief top + flat bottom) + 4 side strips (one row of verts each side)
	const topCount = gridVerts
	const bottomCount = gridVerts
	const sideVertsPerStrip = cols // front/back run along X
	const sideVertsLR = rows // left/right run along Z
	const totalVerts = topCount + bottomCount + sideVertsPerStrip * 2 + sideVertsLR * 2

	const positions = new Float32Array(totalVerts * 3)
	const uvs = new Float32Array(totalVerts * 2)
	let v = 0

	const push = (x: number, y: number, z: number, u: number, w: number) => {
		positions[v * 3] = x
		positions[v * 3 + 1] = y
		positions[v * 3 + 2] = z
		uvs[v * 2] = u
		uvs[v * 2 + 1] = w
		v++
	}

	const elevationAt = (u: number, w: number) => {
		const col = Math.min(Math.floor(u * hmW), hmW - 1)
		const row = Math.min(Math.floor(w * hmH), hmH - 1)
		return heightMap[row][col]
	}

	// Top relief surface
	for (let iz = 0; iz <= gridZ; iz++) {
		for (let ix = 0; ix <= gridX; ix++) {
			const u = ix / gridX
			const w = iz / gridZ
			const x = -halfW + u * plateWidth
			const z = -halfL + w * plateLength
			const y = baseTop + elevationAt(u, w) * reliefHeight
			push(x, y, z, u, w)
		}
	}
	const topStart = 0

	// Bottom flat surface (y = 0)
	for (let iz = 0; iz <= gridZ; iz++) {
		for (let ix = 0; ix <= gridX; ix++) {
			const u = ix / gridX
			const w = iz / gridZ
			const x = -halfW + u * plateWidth
			const z = -halfL + w * plateLength
			push(x, 0, z, u, w)
		}
	}
	const bottomStart = topCount

	// Side strip: front (z = -halfL), runs along X — top edge + bottom edge
	const frontTopStart = v
	for (let ix = 0; ix <= gridX; ix++) {
		const u = ix / gridX
		const x = -halfW + u * plateWidth
		push(x, baseTop + elevationAt(u, 0) * reliefHeight, -halfL, u, 0)
	}
	const frontBottomStart = v
	for (let ix = 0; ix <= gridX; ix++) {
		const u = ix / gridX
		const x = -halfW + u * plateWidth
		push(x, 0, -halfL, u, 0)
	}

	// Side strip: back (z = +halfL)
	const backTopStart = v
	for (let ix = 0; ix <= gridX; ix++) {
		const u = ix / gridX
		const x = -halfW + u * plateWidth
		push(x, baseTop + elevationAt(u, 1) * reliefHeight, halfL, u, 1)
	}
	const backBottomStart = v
	for (let ix = 0; ix <= gridX; ix++) {
		const u = ix / gridX
		const x = -halfW + u * plateWidth
		push(x, 0, halfL, u, 1)
	}

	// Side strip: left (x = -halfW), runs along Z
	const leftTopStart = v
	for (let iz = 0; iz <= gridZ; iz++) {
		const w = iz / gridZ
		const z = -halfL + w * plateLength
		push(-halfW, baseTop + elevationAt(0, w) * reliefHeight, z, 0, w)
	}
	const leftBottomStart = v
	for (let iz = 0; iz <= gridZ; iz++) {
		const w = iz / gridZ
		const z = -halfL + w * plateLength
		push(-halfW, 0, z, 0, w)
	}

	// Side strip: right (x = +halfW)
	const rightTopStart = v
	for (let iz = 0; iz <= gridZ; iz++) {
		const w = iz / gridZ
		const z = -halfL + w * plateLength
		push(halfW, baseTop + elevationAt(1, w) * reliefHeight, z, 1, w)
	}
	const rightBottomStart = v
	for (let iz = 0; iz <= gridZ; iz++) {
		const w = iz / gridZ
		const z = -halfL + w * plateLength
		push(halfW, 0, z, 1, w)
	}

	const indices: number[] = []
	const topQuad = (a: number, b: number, c: number, d: number) => {
		indices.push(a, c, b, b, c, d)
	}

	// Top surface (CCW when viewed from above / +Y)
	for (let iz = 0; iz < gridZ; iz++) {
		for (let ix = 0; ix < gridX; ix++) {
			const a = topStart + iz * cols + ix
			const b = a + 1
			const c = topStart + (iz + 1) * cols + ix
			const d = c + 1
			indices.push(a, c, b, b, c, d)
		}
	}

	// Bottom surface — reverse winding so normals face -Y
	for (let iz = 0; iz < gridZ; iz++) {
		for (let ix = 0; ix < gridX; ix++) {
			const a = bottomStart + iz * cols + ix
			const b = a + 1
			const c = bottomStart + (iz + 1) * cols + ix
			const d = c + 1
			indices.push(a, b, c, b, d, c)
		}
	}

	// Side walls: connect top edge → bottom edge. Outward-facing winding.
	// Front (faces -Z): top row iz=0
	for (let ix = 0; ix < gridX; ix++) {
		const t0 = frontTopStart + ix
		const t1 = t0 + 1
		const b0 = frontBottomStart + ix
		const b1 = b0 + 1
		topQuad(t0, b0, t1, b1)
	}
	// Back (faces +Z)
	for (let ix = 0; ix < gridX; ix++) {
		const t0 = backTopStart + ix
		const t1 = t0 + 1
		const b0 = backBottomStart + ix
		const b1 = b0 + 1
		topQuad(t1, b1, t0, b0)
	}
	// Left (faces -X)
	for (let iz = 0; iz < gridZ; iz++) {
		const t0 = leftTopStart + iz
		const t1 = t0 + 1
		const b0 = leftBottomStart + iz
		const b1 = b0 + 1
		topQuad(t1, b1, t0, b0)
	}
	// Right (faces +X)
	for (let iz = 0; iz < gridZ; iz++) {
		const t0 = rightTopStart + iz
		const t1 = t0 + 1
		const b0 = rightBottomStart + iz
		const b1 = b0 + 1
		topQuad(t0, b0, t1, b1)
	}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
	geometry.setIndex(indices)
	geometry.computeVertexNormals()

	return geometry
}
