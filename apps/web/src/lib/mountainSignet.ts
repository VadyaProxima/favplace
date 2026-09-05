import * as THREE from 'three'
import { embossAmplitude, sculptReliefHeight } from './reliefSculpt.ts'

/**
 * Mountain Signet — continuous metal skin.
 *
 * Side-profile intent (from user sketches):
 * - Inner bore stays a perfect circle
 * - Outer silhouette thickens toward the top and FLOWS into a thin horizontal plateau
 * - Relief is embossed on that plateau surface (continuation of the band), not a stacked insert
 * - Plateau metal under the peaks is thin — no thick brick / vertical wall
 */
export const MOUNTAIN_SIGNET = {
	innerRadius: 1,
	/** half-width along finger at bottom */
	bandHalfZ: 0.18,
	/** half-width along finger at plateau */
	faceHalfZ: 0.52,
	/** half-length of plateau along ring arc — longer relief along the hoop */
	faceHalfArc: 0.72,
	bandThickMin: 0.1,
	/**
	 * Metal thickness at the head — keep modest so the plateau reads thin
	 * (the “height jump” should come from relief, not from a thick gold slab).
	 */
	bandThickMax: 0.19,
	/** how far shoulders flare (fraction of π) — wider = softer flow into plateau */
	flareSpan: 0.92,
	cushionRound: 0.14,
	/** polished rim around relief — keep narrow */
	bezelFrac: 0.04,
	/**
	 * How far outside the flat face the outer curve starts rising into the plateau.
	 * Larger = much softer merge into the hoop circumference.
	 */
	flowBlend: 1.35,
	/**
	 * Arc-end ramp: fraction of face span that keeps full mountain height.
	 * Outside this, emboss + plateau height taper into the hoop (no vertical cliff).
	 */
	endRampKeep: 0.42,
}

const RADIAL = 1000
const SECTION = 104
const SECTION_EXP = 2.45

function smoothstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * (3 - 2 * t)
}

/** Quintic smoothstep — softer shoulders than cubic */
function smootherstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * t * (t * (t * 6 - 15) + 10)
}

function clamp01(x: number) {
	return Math.min(1, Math.max(0, x))
}

function headBlend(absTheta: number, p = MOUNTAIN_SIGNET) {
	// Clamp — float error can push 1-smootherstep slightly below 0,
	// and Math.pow(negative, 0.95) → NaN → origin spike at the shank bottom.
	return clamp01(1 - smootherstep(0, p.flareSpan * Math.PI, absTheta))
}

function sliceDims(absTheta: number, p = MOUNTAIN_SIGNET) {
	const h = headBlend(absTheta, p)
	// Gradual thickness/width along the arc — no sudden brick at the head
	const thickEase = Math.pow(h, 0.95)
	const widthEase = Math.pow(h, 0.75)
	return {
		halfZ: p.bandHalfZ + (p.faceHalfZ - p.bandHalfZ) * widthEase,
		halfT: (p.bandThickMin + (p.bandThickMax - p.bandThickMin) * thickEase) / 2,
		head: h,
	}
}

/** Y of the thin horizontal plateau (metal skin before emboss) */
function plateauY(p = MOUNTAIN_SIGNET) {
	return p.innerRadius + p.bandThickMax
}

function faceSpanTheta(p = MOUNTAIN_SIGNET) {
	return Math.asin(Math.min(0.97, p.faceHalfArc / plateauY(p)))
}

function tableEdge(tx: number, tz: number, p = MOUNTAIN_SIGNET) {
	const ax = Math.abs(tx) / p.faceHalfArc
	const az = Math.abs(tz) / p.faceHalfZ
	const m = Math.max(ax, az)
	if (m <= 1 - p.cushionRound) return m
	const corner = 1 - p.cushionRound
	const dx = Math.max(0, ax - corner)
	const dz = Math.max(0, az - corner)
	return corner + Math.hypot(dx, dz)
}

function tableUV(tx: number, tz: number, p = MOUNTAIN_SIGNET) {
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
	return (
		(hm[y0]?.[x0] ?? 0) * (1 - tx) * (1 - ty) +
		(hm[y0]?.[x1] ?? 0) * tx * (1 - ty) +
		(hm[y1]?.[x0] ?? 0) * (1 - tx) * ty +
		(hm[y1]?.[x1] ?? 0) * tx * ty
	)
}

export function buildDemoMountainHeightMap(size = 128): number[][] {
	const grid: number[][] = []
	for (let y = 0; y < size; y++) {
		const row: number[] = []
		const v = y / (size - 1)
		for (let x = 0; x < size; x++) {
			const u = x / (size - 1)
			const ridge = Math.exp(-Math.pow((v - 0.5) / 0.28, 2))
			const peaks =
				Math.exp(-Math.pow((u - 0.22) / 0.1, 2)) * 0.55 +
				Math.exp(-Math.pow((u - 0.45) / 0.09, 2)) * 0.9 +
				Math.exp(-Math.pow((u - 0.65) / 0.08, 2)) * 1.0 +
				Math.exp(-Math.pow((u - 0.82) / 0.1, 2)) * 0.55
			const noise =
				0.08 *
				(0.5 + 0.5 * Math.sin(u * 18 + v * 7)) *
				(0.5 + 0.5 * Math.sin(u * 33 - v * 12))
			const fade =
				smoothstep(0, 0.08, u) *
				smoothstep(0, 0.08, 1 - u) *
				smoothstep(0, 0.1, v) *
				smoothstep(0, 0.1, 1 - v)
			row.push(clamp01((peaks * ridge + noise) * fade))
		}
		grid.push(row)
	}
	return grid
}

/** Peak height only — plateau floor stays fixed (see reliefSculpt). */
function embossDepth(reliefHeight: number) {
	return embossAmplitude(reliefHeight)
}

export function buildMountainSignet(
	heightMap: number[][] | null,
	reliefHeight = 2,
	p = MOUNTAIN_SIGNET,
): THREE.BufferGeometry {
	const hm =
		heightMap && heightMap.length > 0 ? heightMap : buildDemoMountainHeightMap()
	const depth = embossDepth(reliefHeight)
	const yPlateau = plateauY(p)
	const span = faceSpanTheta(p)
	// Long soft approach: start rising far outside the flat face, fully flat only near center
	const flowStart = Math.min(Math.PI * 0.95, span * (1 + p.flowBlend))
	const flowEnd = span * 0.15

	const positions = new Float32Array(RADIAL * SECTION * 3)
	const isTerrain = new Uint8Array(RADIAL * SECTION)
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

		/**
		 * Outer-radius lift so the silhouette flows into the plateau:
		 * circular outer grows toward plateauY over a long arc (no brick step).
		 */
		const flow = smootherstep(flowStart, flowEnd, absT)
		const circularOuter = p.innerRadius + halfT * 2
		const targetOuter = yPlateau
		const outerLift = (targetOuter - circularOuter) * flow * head

		for (let j = 0; j < SECTION; j++) {
			const phi = (j / SECTION) * Math.PI * 2
			const c = Math.cos(phi)
			const s = Math.sin(phi)

			const axial =
				halfZ * Math.sign(c || 1) * Math.pow(Math.abs(c), 2 / SECTION_EXP)
			const radialBulge =
				halfT * Math.sign(s || 1) * Math.pow(Math.abs(s), 2 / SECTION_EXP)

			// Lift only the outer half of the section toward the plateau envelope
			const outerPull = s > 0 ? smootherstep(0.02, 0.92, s) : 0
			const liftedR =
				rCenter + radialBulge + outerLift * outerPull * 0.65

			let px = liftedR * cosA
			let py = liftedR * sinA
			let pz = axial
			let terrain = 0

			// Comfort bore: nudge inner half toward a clean circle — never scale
			// through the origin (that creates the needle spike at 6 o'clock).
			if (s < -0.02) {
				const rNow = Math.hypot(px, py)
				if (rNow > 1e-6) {
					const innerAmt = smootherstep(0, 1, -s)
					const rCircle = p.innerRadius
					const rTarget = THREE.MathUtils.lerp(rNow, rCircle, innerAmt * 0.85)
					const safeR = Math.max(rTarget, p.innerRadius * 0.98)
					const scl = safeR / rNow
					px *= scl
					py *= scl
				}
			}

			// Outer skin → thin plateau + embossed relief (same continuous surface).
			// Hard-gated to the head arc so bottom shank can never be pulled to the table.
			if (s > 0.04 && head > 0.02 && absT < flowStart) {
				const shell = smootherstep(0.04, 0.98, s)
				const flatten = flow * shell

				if (flatten > 0.008) {
					const arcX = Math.sin(thetaNorm) * yPlateau
					const tz =
						Math.sign(axial || 1) * Math.min(Math.abs(axial), halfZ)
					const tx = THREE.MathUtils.clamp(
						arcX,
						-p.faceHalfArc * 1.2,
						p.faceHalfArc * 1.2,
					)
					const zFace = THREE.MathUtils.clamp(tz, -p.faceHalfZ, p.faceHalfZ)

					const edge = tableEdge(tx, zFace, p)
					const { u, v } = tableUV(tx, zFace, p)
					const bezelT = smootherstep(1 - p.bezelFrac, 1, edge)

					/**
					 * End ramp along the hoop (left/right in side view):
					 * 1 near the middle of the plateau → 0 at the ends,
					 * so mountains slope into the band instead of a vertical cliff.
					 */
					const keep = span * p.endRampKeep
					const endRamp = smootherstep(span * 1.12, keep, absT)

					const h = sculptReliefHeight(sampleHeightMap(hm, u, v))
					// Peak emboss only — floor stays at ySkin (slider doesn't thicken base)
					const embossRaw =
						shell > 0.45 ? h * depth * (1 - bezelT * 0.85) : 0
					const emboss = embossRaw * Math.max(endRamp, 0.35)

					const ySkin = THREE.MathUtils.lerp(
						circularOuter + outerLift * 0.25,
						yPlateau,
						endRamp,
					)
					const yTarget = ySkin + emboss

					const circX = Math.sin(thetaNorm) * (circularOuter + outerLift * 0.45)
					const circZ = tz
					const flatMix = 0.25 + 0.75 * endRamp
					const xTarget = THREE.MathUtils.lerp(circX, tx, flatMix)
					const zTarget = THREE.MathUtils.lerp(circZ, zFace, flatMix)

					if (
						shell > 0.68 &&
						bezelT < 0.55 &&
						endRamp > 0.12 &&
						emboss > depth * 0.01
					) {
						terrain = 1
					}

					const k = flatten * (0.35 + 0.6 * flow)
					px = px * (1 - k) + xTarget * k
					py = py * (1 - k) + yTarget * k
					pz = pz * (1 - k) + zTarget * k
				}
			}

			// Safety: never allow verts inside the finger hole (kills origin-spikes)
			{
				const r = Math.hypot(px, py)
				const rMin = p.innerRadius * 0.97
				if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
					// Fall back to clean circular section — never (0,0,0), never use NaN halfT
					const safeHalfT = p.bandThickMin / 2
					px = (p.innerRadius + safeHalfT) * cosA
					py = (p.innerRadius + safeHalfT) * sinA
					pz = Number.isFinite(axial) ? axial : 0
					terrain = 0
				} else if (r > 1e-8 && r < rMin) {
					const scl = rMin / r
					px *= scl
					py *= scl
				}
			}

			positions[vi * 3] = px
			positions[vi * 3 + 1] = py
			positions[vi * 3 + 2] = pz
			isTerrain[vi] = terrain
			vi++
		}
	}

	const bandIdx: number[] = []
	const terrainIdx: number[] = []
	for (let i = 0; i < RADIAL; i++) {
		const i2 = (i + 1) % RADIAL
		for (let j = 0; j < SECTION; j++) {
			const j2 = (j + 1) % SECTION
			const a = i * SECTION + j
			const b = i * SECTION + j2
			const c = i2 * SECTION + j
			const d = i2 * SECTION + j2
			const pushTri = (i0: number, i1: number, i2: number) => {
				const votes =
					(isTerrain[i0] ? 1 : 0) +
					(isTerrain[i1] ? 1 : 0) +
					(isTerrain[i2] ? 1 : 0)
				;(votes >= 2 ? terrainIdx : bandIdx).push(i0, i1, i2)
			}
			pushTri(a, c, b)
			pushTri(b, c, d)
		}
	}

	const indices = bandIdx.concat(terrainIdx)
	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setIndex(indices)
	geometry.addGroup(0, bandIdx.length, 0)
	geometry.addGroup(bandIdx.length, terrainIdx.length, 1)
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}

export function getMountainSignetBottomY(geometry: THREE.BufferGeometry) {
	geometry.computeBoundingBox()
	return geometry.boundingBox?.min.y ?? -1.2
}
