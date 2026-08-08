import * as THREE from 'three'
import { buildDemoMountainHeightMap } from './mountainSignet'
import { embossAmplitude, sculptReliefHeight } from './reliefSculpt'

/**
 * Bar ring — one continuous outer ribbon (plateau → scoсы → hoop).
 *
 * No separate “brick end” / vertical cliff: every Z-strip is a function of
 * angle. Emboss sits on that curve and fades toward the hoop, so the scoс
 * always starts from the local rim peak.
 */
export const BAR_RING = {
	innerRadius: 1,
	bandHalfZ: 0.16,
	topHalfZ: 0.24,
	bandThick: 0.11,
	/** angle where the flat plateau ends (from +Y) */
	flatHalfAng: 0.55,
	/** scoс continues this far past the flat (radians) */
	shoulderAng: 0.85,
	/** after landing, hoop tapers to bandHalfZ */
	flareTaper: 0.55,
	bandEmbed: 0.03,
	bezelFrac: 0.05,
	/** fraction of flatHalfAng that stays fully flat before rolling into scoс */
	flatKeep: 0.62,
	/** emboss fade along scoс (higher = holds longer, then soft drop) */
	reliefFadePow: 1.65,
	bandRadial: 720,
	bandSection: 44,
	/** samples along half-arc 0 → flat+shoulder */
	arcSteps: 96,
	zSteps: 72,
}

type P = typeof BAR_RING

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

function smoothstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * (3 - 2 * t)
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
	terrain: boolean,
) {
	;(terrain ? parts.terrainIdx : parts.bandIdx).push(a, b, c)
}

function pushQuad(
	parts: MeshParts,
	a: number,
	b: number,
	c: number,
	d: number,
	terrain: boolean,
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
		geo: THREE.BufferGeometry,
		idx: THREE.BufferAttribute,
		offset: number,
	) => {
		const groups = geo.groups.length
			? geo.groups
			: [{ start: 0, count: idx.count, materialIndex: 0 }]
		for (const g of groups) {
			const dest = (g.materialIndex ?? 0) === 1 ? terrainIdx : bandIdx
			for (let i = g.start; i < g.start + g.count; i++) {
				dest.push(idx.getX(i) + offset)
			}
		}
	}
	collect(a, idxA, 0)
	collect(b, idxB, nA)

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

function angFromTop(alpha: number) {
	const fromTop = Math.abs(Math.PI / 2 - alpha)
	return Math.min(fromTop, Math.PI * 2 - fromTop)
}

function halfZAtAng(angTop: number, landAng: number, p: P) {
	const wideUntil = landAng + 0.05
	const taperEnd = wideUntil + p.flareTaper
	const flare = 1 - smootherstep(wideUntil, taperEnd, angTop)
	return THREE.MathUtils.lerp(p.bandHalfZ, p.topHalfZ, flare)
}

function buildBand(p: P): THREE.BufferGeometry {
	const parts = emptyParts()
	const halfT = p.bandThick / 2
	const rCenter = p.innerRadius + halfT
	const landAng = p.flatHalfAng + p.shoulderAng
	const grid: number[][] = []

	for (let i = 0; i < p.bandRadial; i++) {
		const theta = (i / p.bandRadial) * Math.PI * 2
		const alpha = Math.PI / 2 - theta
		const cosA = Math.cos(alpha)
		const sinA = Math.sin(alpha)
		const halfZ = halfZAtAng(angFromTop(alpha), landAng, p)
		const row: number[] = []
		for (let j = 0; j < p.bandSection; j++) {
			const phi = (j / p.bandSection) * Math.PI * 2
			const c = Math.cos(phi)
			const s = Math.sin(phi)
			const exp = 2.25
			const axial =
				halfZ * Math.sign(c || 1) * Math.pow(Math.abs(c), 2 / exp)
			const radialBulge =
				halfT * Math.sign(s || 1) * Math.pow(Math.abs(s), 2 / exp)
			const r = rCenter + radialBulge
			row.push(pushV(parts, r * cosA, r * sinA, axial))
		}
		grid.push(row)
	}

	for (let i = 0; i < p.bandRadial; i++) {
		const i2 = (i + 1) % p.bandRadial
		for (let j = 0; j < p.bandSection; j++) {
			const j2 = (j + 1) % p.bandSection
			pushQuad(parts, grid[i][j], grid[i][j2], grid[i2][j], grid[i2][j2], false)
		}
	}
	return partsToGeometry(parts)
}

/**
 * Profile of the outer ribbon at angle `ang` from +Y (0 = top center).
 * Returns metal floor Y on the circle and emboss fade 0..1.
 */
function ribbonProfile(ang: number, p: P, rSurf: number, yFloor: number) {
	const flatEnd = p.flatHalfAng
	const land = flatEnd + p.shoulderAng
	const keep = flatEnd * p.flatKeep

	// Metal floor: flat near center → smooth roll onto the circle through scoс
	let yMetal: number
	let onCircle = 0
	if (ang <= keep) {
		yMetal = yFloor
		onCircle = 0
	} else if (ang <= flatEnd) {
		const s = smootherstep(keep, flatEnd, ang)
		const yC = rSurf * Math.cos(ang)
		yMetal = THREE.MathUtils.lerp(yFloor, yC, s)
		onCircle = s
	} else {
		yMetal = rSurf * Math.cos(Math.min(ang, land))
		onCircle = 1
	}

	// Relief: full on plateau, fades along scoс to 0 at landing
	let fade: number
	if (ang <= keep) {
		fade = 1
	} else if (ang <= flatEnd) {
		// Still nearly full while floor starts rolling — peaks lead the scoс
		fade = THREE.MathUtils.lerp(1, 0.92, smootherstep(keep, flatEnd, ang))
	} else {
		const t = clamp01((ang - flatEnd) / Math.max(p.shoulderAng, 1e-4))
		fade = Math.pow(1 - t, p.reliefFadePow)
	}

	return { yMetal, fade, onCircle, land }
}

function buildRibbon(
	hm: number[][],
	depth: number,
	p: P,
): THREE.BufferGeometry {
	const parts = emptyParts()
	const R = p.innerRadius + p.bandThick
	const rSurf = R - p.bandEmbed
	const yFloor = rSurf
	const landAng = p.flatHalfAng + p.shoulderAng
	const nA = p.arcSteps
	const nZ = p.zSteps
	const hz = p.topHalfZ

	// Full arc -landAng … +landAng (symmetric ribbon)
	const top: number[][] = []
	const bot: number[][] = []
	const terr: boolean[][] = []

	for (let iz = 0; iz <= nZ; iz++) {
		const v = iz / nZ
		const zN = (v - 0.5) * 2 // -1..1
		const tRow: number[] = []
		const bRow: number[] = []
		const eRow: boolean[] = []

		for (let ia = 0; ia <= nA; ia++) {
			const aN = ia / nA // 0..1
			const ang = (aN - 0.5) * 2 * landAng // -land … +land
			const absAng = Math.abs(ang)
			const side = ang === 0 ? 1 : Math.sign(ang)

			const { yMetal, fade, onCircle } = ribbonProfile(
				absAng,
				p,
				rSurf,
				yFloor,
			)

			// UV: along plateau map ang→u; past flat edge, pin to u=0/1 so ridges continue
			const uFlat = clamp01(ang / (2 * p.flatHalfAng) + 0.5)
			const u =
				absAng <= p.flatHalfAng ? uFlat : side > 0 ? 1 : 0
			const az = Math.abs(zN)
			const bezel = smoothstep(1 - p.bezelFrac, 0.999, az)
			const h = sculptReliefHeight(sampleHeightMap(hm, u, v))
			const emboss = h * depth * (1 - bezel * 0.75) * fade

			// Position on circle in XY; near center flatten X toward chord of flat plateau
			const xC = side * rSurf * Math.sin(absAng)
			const yC = rSurf * Math.cos(absAng)
			// Blend: flat plateau uses nearly linear X strip; scoс is pure circle
			const flatX =
				absAng < 1e-6
					? 0
					: side * Math.sin(p.flatHalfAng) * rSurf * (absAng / p.flatHalfAng)
			let x: number
			let y: number
			if (absAng <= p.flatHalfAng) {
				const s = onCircle
				x = THREE.MathUtils.lerp(flatX, xC, s)
				y = yMetal + emboss
			} else {
				// Scoс: on circle — emboss already fading; no vertical end face
				x = xC
				y = yC + emboss
			}

			const hzHere = halfZAtAng(absAng, landAng, p)
			const z = zN * hzHere

			tRow.push(pushV(parts, x, y, z))

			// Underlay on circle, same Z width
			const yB = absAng < 1e-6 ? rSurf : yC
			const xB = absAng < 1e-6 ? 0 : xC
			bRow.push(pushV(parts, xB, yB, z))
			eRow.push(emboss > depth * 0.015 && fade > 0.05)
		}
		top.push(tRow)
		bot.push(bRow)
		terr.push(eRow)
	}

	for (let iz = 0; iz < nZ; iz++) {
		for (let ia = 0; ia < nA; ia++) {
			const terrain =
				terr[iz][ia] ||
				terr[iz][ia + 1] ||
				terr[iz + 1][ia] ||
				terr[iz + 1][ia + 1]
			pushQuad(
				parts,
				top[iz][ia],
				top[iz][ia + 1],
				top[iz + 1][ia],
				top[iz + 1][ia + 1],
				terrain,
			)
		}
	}

	for (let iz = 0; iz < nZ; iz++) {
		for (let ia = 0; ia < nA; ia++) {
			pushQuad(
				parts,
				bot[iz][ia],
				bot[iz + 1][ia],
				bot[iz][ia + 1],
				bot[iz + 1][ia + 1],
				false,
			)
		}
	}

	// Seal ±Z long sides
	for (let ia = 0; ia < nA; ia++) {
		pushQuad(parts, top[0][ia], bot[0][ia], top[0][ia + 1], bot[0][ia + 1], false)
		pushQuad(
			parts,
			top[nZ][ia],
			top[nZ][ia + 1],
			bot[nZ][ia],
			bot[nZ][ia + 1],
			false,
		)
	}

	// Seal arc ends (landing)
	pushQuad(
		parts,
		top[0][0],
		top[nZ][0],
		bot[0][0],
		bot[nZ][0],
		false,
	)
	pushQuad(
		parts,
		top[0][nA],
		bot[0][nA],
		top[nZ][nA],
		bot[nZ][nA],
		false,
	)

	return partsToGeometry(parts)
}

export function buildBarRing(
	heightMap: number[][] | null,
	reliefHeight = 2,
	p = BAR_RING,
): THREE.BufferGeometry {
	const hm =
		heightMap && heightMap.length > 0
			? heightMap
			: buildDemoMountainHeightMap(160)
	const depth = embossAmplitude(reliefHeight)
	return mergeGeometries(buildBand(p), buildRibbon(hm, depth, p))
}

export function getBarRingBottomY(geometry: THREE.BufferGeometry) {
	geometry.computeBoundingBox()
	return geometry.boundingBox?.min.y ?? -1.2
}
