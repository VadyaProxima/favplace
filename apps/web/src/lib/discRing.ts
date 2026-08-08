import * as THREE from 'three'
import { buildDemoMountainHeightMap } from './mountainSignet'
import { embossAmplitude, sculptReliefHeight } from './reliefSculpt'

/**
 * Disc / Plug rings.
 * - Disc / Plug: same tube section; disc has larger insert radius
 */

export const DISC_RING = {
	innerRadius: 1,
	/** Same hoop thickness as plug */
	tubeRadius: 0.095,
	cylRadius: 0.52,
	/** No drum under relief — emboss sits on the band */
	cylHeight: 0,
	sink: 0.012,
	bezelFrac: 0.08,
	wallSegments: 160,
	capSegments: 140,
	bandRadial: 720,
	bandSection: 40,
}

export const PLUG_RING = {
	innerRadius: 1,
	tubeRadius: 0.095,
	cylRadius: 0.38,
	cylHeight: 0,
	sink: 0.02,
	bezelFrac: 0.08,
	wallSegments: 160,
	capSegments: 140,
	bandRadial: 720,
	bandSection: 40,
}

type RingParams = typeof DISC_RING

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

function smoothstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * (3 - 2 * t)
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

function embossDepth(reliefHeight: number) {
	return embossAmplitude(reliefHeight)
}

type MeshParts = {
	positions: number[]
	bandIdx: number[]
	terrainIdx: number[]
}

function emptyParts(): MeshParts {
	return { positions: [], bandIdx: [], terrainIdx: [] }
}

function pushV(parts: MeshParts, x: number, y: number, z: number) {
	const i = parts.positions.length / 3
	parts.positions.push(x, y, z)
	return i
}

function pushTri(
	parts: MeshParts,
	a: number,
	b: number,
	c: number,
	terrain = false,
) {
	;(terrain ? parts.terrainIdx : parts.bandIdx).push(a, b, c)
}

function pushQuad(
	parts: MeshParts,
	a: number,
	b: number,
	c: number,
	d: number,
	terrain = false,
) {
	pushTri(parts, a, c, b, terrain)
	pushTri(parts, b, c, d, terrain)
}

function partsToGeometry(parts: MeshParts): THREE.BufferGeometry {
	const geometry = new THREE.BufferGeometry()
	const pos = new Float32Array(parts.positions)
	for (let i = 0; i < pos.length; i++) {
		if (!Number.isFinite(pos[i])) pos[i] = 0
	}
	geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
	const indices = parts.bandIdx.concat(parts.terrainIdx)
	geometry.setIndex(indices)
	geometry.addGroup(0, parts.bandIdx.length, 0)
	geometry.addGroup(parts.bandIdx.length, parts.terrainIdx.length, 1)
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}

function mergeGeometries(
	a: THREE.BufferGeometry,
	b: THREE.BufferGeometry,
): THREE.BufferGeometry {
	const posA = a.getAttribute('position') as THREE.BufferAttribute
	const posB = b.getAttribute('position') as THREE.BufferAttribute
	const idxA = a.getIndex()!
	const idxB = b.getIndex()!
	const nA = posA.count

	const positions = new Float32Array((nA + posB.count) * 3)
	positions.set(posA.array as Float32Array, 0)
	positions.set(posB.array as Float32Array, nA * 3)

	const bandIdx: number[] = []
	const terrainIdx: number[] = []

	const collect = (
		idx: THREE.BufferAttribute,
		offset: number,
		groups: { start: number; count: number; materialIndex?: number }[],
	) => {
		for (const g of groups) {
			const dest = (g.materialIndex ?? 0) === 1 ? terrainIdx : bandIdx
			for (let i = g.start; i < g.start + g.count; i++) {
				dest.push(idx.getX(i) + offset)
			}
		}
	}

	collect(
		idxA,
		0,
		a.groups.length ? a.groups : [{ start: 0, count: idxA.count, materialIndex: 0 }],
	)
	collect(
		idxB,
		nA,
		b.groups.length ? b.groups : [{ start: 0, count: idxB.count, materialIndex: 0 }],
	)

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	const indices = bandIdx.concat(terrainIdx)
	geometry.setIndex(indices)
	geometry.addGroup(0, bandIdx.length, 0)
	geometry.addGroup(bandIdx.length, terrainIdx.length, 1)
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}

/** Round-tube hoop (circular cross-section). */
function buildBand(p: RingParams): THREE.BufferGeometry {
	const parts = emptyParts()
	const radial = p.bandRadial
	const section = p.bandSection
	const grid: number[][] = []

	for (let i = 0; i < radial; i++) {
		const theta = (i / radial) * Math.PI * 2
		const alpha = Math.PI / 2 - theta
		const cosA = Math.cos(alpha)
		const sinA = Math.sin(alpha)
		const row: number[] = []
		for (let j = 0; j < section; j++) {
			const phi = (j / section) * Math.PI * 2
			const c = Math.cos(phi)
			const s = Math.sin(phi)
			const r = p.innerRadius + p.tubeRadius * (1 + s)
			row.push(pushV(parts, r * cosA, r * sinA, p.tubeRadius * c))
		}
		grid.push(row)
	}

	for (let i = 0; i < radial; i++) {
		const i2 = (i + 1) % radial
		for (let j = 0; j < section; j++) {
			const j2 = (j + 1) % section
			pushQuad(parts, grid[i][j], grid[i][j2], grid[i2][j], grid[i2][j2], false)
		}
	}

	return partsToGeometry(parts)
}

/**
 * Relief insert on the band — no tall cylindrical “drum” under the mountains.
 * Just an embossed disc whose floor sits in the hoop.
 */
function buildCylinderInsert(
	hm: number[][],
	depth: number,
	p: RingParams,
): THREE.BufferGeometry {
	const parts = emptyParts()
	const segs = p.wallSegments
	const rings = p.capSegments

	const wireOuter = p.innerRadius + p.tubeRadius * 2
	// Floor of the relief = top of the band (no extra platform height)
	const yBase = wireOuter - p.sink - p.tubeRadius * 0.25

	// Thin underside seal (hidden in the band) — not a visible drum wall
	const yBot = yBase - Math.max(p.tubeRadius * 0.15, 0.008)
	const botRim: number[] = []
	for (let i = 0; i <= segs; i++) {
		const a = (i / segs) * Math.PI * 2
		botRim.push(
			pushV(parts, Math.cos(a) * p.cylRadius, yBot, Math.sin(a) * p.cylRadius),
		)
	}
	const botCenter = pushV(parts, 0, yBot, 0)
	for (let i = 0; i < segs; i++) {
		pushTri(parts, botCenter, botRim[i], botRim[i + 1], false)
	}

	// Short skirt from underside up to the relief floor (stays inside the band)
	const floorRim: number[] = []
	for (let i = 0; i <= segs; i++) {
		const a = (i / segs) * Math.PI * 2
		floorRim.push(
			pushV(parts, Math.cos(a) * p.cylRadius, yBase, Math.sin(a) * p.cylRadius),
		)
	}
	for (let i = 0; i < segs; i++) {
		pushQuad(parts, botRim[i], botRim[i + 1], floorRim[i], floorRim[i + 1], false)
	}

	const grid: number[][] = []
	for (let iy = 0; iy <= rings; iy++) {
		const row: number[] = []
		const vv = iy / rings
		const z = (vv - 0.5) * 2 * p.cylRadius
		for (let ix = 0; ix <= rings; ix++) {
			const uu = ix / rings
			const x = (uu - 0.5) * 2 * p.cylRadius
			const rr = Math.hypot(x, z) / p.cylRadius

			if (rr >= 0.999) {
				const ang = Math.atan2(z, x || 1e-6)
				row.push(
					pushV(
						parts,
						Math.cos(ang) * p.cylRadius,
						yBase,
						Math.sin(ang) * p.cylRadius,
					),
				)
				continue
			}

			const rim = smoothstep(1 - p.bezelFrac, 0.998, rr)
			const h = sculptReliefHeight(sampleHeightMap(hm, uu, vv))
			const emboss = h * depth * (1 - rim)
			row.push(pushV(parts, x, yBase + emboss, z))
		}
		grid.push(row)
	}

	for (let iy = 0; iy < rings; iy++) {
		for (let ix = 0; ix < rings; ix++) {
			const cx = ((ix + 0.5) / rings - 0.5) * 2
			const cz = ((iy + 0.5) / rings - 0.5) * 2
			const rMid = Math.hypot(cx, cz)
			if (rMid > 1.02) continue

			const a = grid[iy][ix]
			const b = grid[iy][ix + 1]
			const c = grid[iy + 1][ix]
			const d = grid[iy + 1][ix + 1]

			const ya = parts.positions[a * 3 + 1]
			const yb = parts.positions[b * 3 + 1]
			const yc = parts.positions[c * 3 + 1]
			const yd = parts.positions[d * 3 + 1]
			const avgY = (ya + yb + yc + yd) * 0.25
			const terrain = rMid < 0.9 && avgY > yBase + depth * 0.03
			pushQuad(parts, a, b, c, d, terrain)
		}
	}

	return partsToGeometry(parts)
}

function buildComposite(
	heightMap: number[][] | null,
	reliefHeight: number,
	p: RingParams,
): THREE.BufferGeometry {
	const hm =
		heightMap && heightMap.length > 0 ? heightMap : buildDemoMountainHeightMap(160)
	const depth = embossDepth(reliefHeight)
	const band = buildBand(p)
	const insert = buildCylinderInsert(hm, depth, p)
	return mergeGeometries(band, insert)
}

export function buildDiscRing(
	heightMap: number[][] | null,
	reliefHeight = 2,
	p = DISC_RING,
): THREE.BufferGeometry {
	return buildComposite(heightMap, reliefHeight, p)
}

export function buildPlugRing(
	heightMap: number[][] | null,
	reliefHeight = 2,
	p = PLUG_RING,
): THREE.BufferGeometry {
	return buildComposite(heightMap, reliefHeight, p)
}

export function getDiscRingBottomY(geometry: THREE.BufferGeometry) {
	geometry.computeBoundingBox()
	return geometry.boundingBox?.min.y ?? -1.2
}

export const getPlugRingBottomY = getDiscRingBottomY
