import * as THREE from 'three'

/**
 * Classic signet profile — inspired by jewellery CAD (top / mid / bottom loft)
 * and references like Sketchfab "classic signet ring".
 *
 * One continuous metal mesh:
 *   narrow comfort band → broad shoulders → flat cushion table with recessed bezel.
 * Terrain is engraved into the recess, not stacked on top.
 */
export const SIGNET = {
	innerRadius: 1,
	/** half-width along finger (Z) at bottom shank */
	bandHalfZ: 0.22,
	/** half-width along finger at table */
	faceHalfZ: 0.48,
	/** half-width along ring arc at table (square map frame) */
	faceHalfArc: 0.4,
	bandThickMin: 0.09,
	bandThickMax: 0.21,
	/** 0=top … 1=how far down shoulders extend (fraction of π) */
	flareSpan: 0.62,
	/** corner radius of cushion table (0=square, 1=circle) */
	cushionRound: 0.18,
	/** metal rim width around recess (normalised 0–1 from table edge) */
	bezelFrac: 0.1,
}

const RADIAL = 420
const SECTION = 40
const SECTION_EXP = 2.6

function smoothstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * (3 - 2 * t)
}

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

/** 1 at top (θ≈0), 0 at bottom shank */
function headBlend(absTheta: number, p = SIGNET) {
	return 1 - smoothstep(0, p.flareSpan * Math.PI, absTheta)
}

function sliceDims(absTheta: number, p = SIGNET) {
	const h = headBlend(absTheta, p)
	const halfZ = p.bandHalfZ + (p.faceHalfZ - p.bandHalfZ) * h
	const halfT =
		(p.bandThickMin + (p.bandThickMax - p.bandThickMin) * h) / 2
	return { halfZ, halfT, head: h }
}

function crownY(absTheta: number, p = SIGNET) {
	const { halfT } = sliceDims(absTheta, p)
	return p.innerRadius + halfT * 2
}

function faceSpanTheta(p = SIGNET) {
	const crown = crownY(0, p)
	return Math.asin(Math.min(0.94, p.faceHalfArc / crown))
}

/** Cushion / rounded-rect metric: 0 inside, 1 on edge */
function tableEdge(tx: number, tz: number, p = SIGNET) {
	const ax = Math.abs(tx) / p.faceHalfArc
	const az = Math.abs(tz) / p.faceHalfZ
	const m = Math.max(ax, az)
	if (m <= 1 - p.cushionRound) return m
	const corner = 1 - p.cushionRound
	const dx = Math.max(0, ax - corner)
	const dz = Math.max(0, az - corner)
	return corner + Math.sqrt(dx * dx + dz * dz)
}

function tableUV(tx: number, tz: number, p = SIGNET) {
	return {
		u: clamp01(tx / (p.faceHalfArc * 2) + 0.5),
		v: clamp01(tz / (p.faceHalfZ * 2) + 0.5),
	}
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

export function buildSignetRing(
	heightMap: number[][] | null,
	reliefDepth: number,
	p = SIGNET,
): THREE.BufferGeometry {
	const hm = heightMap && heightMap.length > 0 ? heightMap : null
	const positions = new Float32Array(RADIAL * SECTION * 3)
	let vi = 0

	for (let i = 0; i < RADIAL; i++) {
		const theta = (i / RADIAL) * Math.PI * 2
		const thetaNorm = theta > Math.PI ? theta - Math.PI * 2 : theta
		const absT = Math.abs(thetaNorm)
		const { halfZ, halfT, head } = sliceDims(absT, p)
		const rCenter = p.innerRadius + halfT
		const alpha = Math.PI / 2 - theta
		const cosA = Math.cos(alpha)
		const sinA = Math.sin(alpha)
		const yCrown = crownY(absT, p)
		const span = faceSpanTheta(p)
		const inHead = absT <= span * 1.08

		for (let j = 0; j < SECTION; j++) {
			const phi = (j / SECTION) * Math.PI * 2
			const c = Math.cos(phi)
			const s = Math.sin(phi)

			// superellipse cross-section: c = axial (Z), s = radial bulge
			const axial =
				halfZ * Math.sign(c) * Math.pow(Math.abs(c), 2 / SECTION_EXP)
			const radialBulge =
				halfT * Math.sign(s) * Math.pow(Math.abs(s), 2 / SECTION_EXP)
			const naturalR = rCenter + radialBulge

			let px = naturalR * cosA
			let py = naturalR * sinA
			let pz = axial

			// comfort-fit inner bore (slight rounding on s < 0)
			if (s < 0) {
				const comfort = 0.06 * (1 - Math.abs(s))
				const rComfort = p.innerRadius + comfort
				const rNow = Math.hypot(px, py)
				if (rNow > 1e-6 && rNow < rComfort + halfT) {
					const scale = (rComfort + (rNow - p.innerRadius) * 0.92) / rNow
					px *= scale
					py *= scale
				}
			}

			// outer shell → flatten to table + engrave recess
			if (s > 0 && head > 0.08) {
				const shell = smoothstep(0, 0.98, s)
				const rise = shell * head

				if (inHead && rise > 0.02) {
					const tx = yCrown * Math.sin(thetaNorm)
					const tz = Math.sign(axial) * Math.min(Math.abs(axial), p.faceHalfZ)
					const edge = tableEdge(tx, tz, p)

					if (edge <= 1.08) {
						const { u, v } = tableUV(tx, tz, p)
						// bezel: full depth in centre, rim stays at table height
						const bezelT = smoothstep(
							1 - p.bezelFrac,
							1,
							edge,
						)
						const carve =
							hm && shell > 0.55
								? sampleHeightMap(hm, u, v) * reliefDepth * shell * (1 - bezelT)
								: 0
						const yTable = yCrown - carve

						px = px * (1 - rise) + tx * rise
						py = py * (1 - rise) + yTable * rise
						pz = pz * (1 - rise) + tz * rise
					}
				} else if (rise > 0.02) {
					// shoulders: pull outer shell toward sloped envelope
					const shoulderZ =
						p.bandHalfZ +
						(p.faceHalfZ - p.bandHalfZ) *
							smoothstep(span * 1.08, span * 0.35, absT)
					const tz = Math.sign(axial) * Math.min(Math.abs(axial), shoulderZ)
					const tx = yCrown * Math.sin(thetaNorm) * 0.55
					const ySlope =
						yCrown -
						smoothstep(span * 0.35, span * 1.1, absT) * halfT * 0.35

					px = px * (1 - rise * 0.7) + tx * rise * 0.7
					py = py * (1 - rise * 0.7) + ySlope * rise * 0.7
					pz = pz * (1 - rise * 0.7) + tz * rise * 0.7
				}
			}

			positions[vi * 3] = px
			positions[vi * 3 + 1] = py
			positions[vi * 3 + 2] = pz
			vi++
		}
	}

	const indices: number[] = []
	for (let i = 0; i < RADIAL; i++) {
		const i2 = (i + 1) % RADIAL
		for (let j = 0; j < SECTION; j++) {
			const j2 = (j + 1) % SECTION
			const a = i * SECTION + j
			const b = i * SECTION + j2
			const c = i2 * SECTION + j
			const d = i2 * SECTION + j2
			indices.push(a, c, b, b, c, d)
		}
	}

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setIndex(indices)

	for (let k = 0; k < positions.length; k++) {
		if (!Number.isFinite(positions[k])) positions[k] = 0
	}

	geometry.computeVertexNormals()
	return geometry
}

export function buildTaperedShank(p = SIGNET) {
	return buildSignetRing(null, 0, p)
}

export function buildReliefCap(
	heightMap: number[][] | null,
	reliefDepth: number,
	p = SIGNET,
) {
	return buildSignetRing(heightMap, reliefDepth, p)
}
