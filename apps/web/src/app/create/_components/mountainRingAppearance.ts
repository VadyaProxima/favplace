import { makeJewelleryMaterial } from '../../../lib/jewelleryMaterial.ts'
import type { SurfaceFinish } from '@favplace/shared'

type MetalAppearance = {
	color: string
	metalness: number
	roughness: number
}

/** Keep the relief and the rest of the ring in one continuous polished finish. */
export function makeMountainRingMaterials(
	source: MetalAppearance,
	surfaceFinish: SurfaceFinish,
) {
	const body = makeJewelleryMaterial({
		color: source.color,
		metalness: source.metalness,
		roughness: source.roughness,
		polished: surfaceFinish === 'polished',
		variant: 'band',
	})

	return { body, relief: body.clone() }
}
