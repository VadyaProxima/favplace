import * as THREE from 'three'

/**
 * Fully opaque jewellery metal.
 * MeshStandardMaterial — no transmission / clearcoat multipass that can read as glass.
 */
export function makeJewelleryMaterial(opts: {
	color: string
	metalness: number
	roughness: number
	polished: boolean
	variant?: 'band' | 'terrain' | 'frost'
}) {
	const polished = opts.polished
	const variant = opts.variant ?? 'band'

	if (variant === 'frost') {
		return forceOpaque(
			new THREE.MeshStandardMaterial({
				color: new THREE.Color('#f2f5f7'),
				metalness: 0.88,
				roughness: polished ? 0.2 : 0.38,
				envMapIntensity: 1.2,
			}),
		)
	}

	const isTerrain = variant === 'terrain'
	const baseRough = Math.min(0.35, Math.max(0.08, opts.roughness))
	const roughness = polished
		? baseRough * (isTerrain ? 0.9 : 0.5)
		: isTerrain
			? 0.4
			: 0.34

	return forceOpaque(
		new THREE.MeshStandardMaterial({
			color: new THREE.Color(opts.color),
			metalness: Math.min(1, opts.metalness + (polished ? 0.05 : 0)),
			roughness,
			envMapIntensity: polished ? (isTerrain ? 1.35 : 1.6) : 1.0,
		}),
	)
}

/** Nuke every transparency-related flag on a material. */
export function forceOpaque<T extends THREE.Material>(mat: T): T {
	mat.transparent = false
	mat.opacity = 1
	mat.depthWrite = true
	mat.depthTest = true
	mat.side = THREE.FrontSide
	mat.alphaTest = 0
	mat.alphaToCoverage = false
	mat.blending = THREE.NormalBlending
	mat.toneMapped = true
	if ('transmission' in mat) {
		;(mat as THREE.MeshPhysicalMaterial).transmission = 0
	}
	if ('thickness' in mat) {
		;(mat as THREE.MeshPhysicalMaterial).thickness = 0
	}
	if ('attenuationDistance' in mat) {
		;(mat as THREE.MeshPhysicalMaterial).attenuationDistance = Infinity
	}
	if ('forceSinglePass' in mat) {
		;(mat as THREE.MeshPhysicalMaterial).forceSinglePass = true
	}
	mat.needsUpdate = true
	return mat
}

/** Shared WebGL canvas flags — opaque framebuffer, no alpha holes. */
export const JEWELLERY_GL = {
	antialias: true as const,
	alpha: false as const,
	premultipliedAlpha: false as const,
	preserveDrawingBuffer: true as const,
	toneMapping: THREE.ACESFilmicToneMapping,
	toneMappingExposure: 1.2,
}

/**
 * Reflections = Environment HDRI mapped onto metal.
 * Custom nature HDRI from /public/models.
 */
export const JEWELLERY_ENV = {
	files: '/models/PrirodaHDRI_68.hdr',
	environmentIntensity: 1.15,
	blur: 0.15,
	toneMappingExposure: JEWELLERY_GL.toneMappingExposure,
}
