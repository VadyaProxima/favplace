'use client'

import { JEWELLERY_ENV, JEWELLERY_LIGHTS } from '@/lib/jewelleryMaterial'
import { Environment } from '@react-three/drei'

/**
 * Custom nature HDRI + warm key lights so the top face stays bright.
 */
export function JewelleryLighting() {
	return (
		<>
			<hemisphereLight args={[JEWELLERY_LIGHTS.hemisphere.sky, JEWELLERY_LIGHTS.hemisphere.ground, JEWELLERY_LIGHTS.hemisphere.intensity]} />
			<ambientLight intensity={JEWELLERY_LIGHTS.ambient} />
			{JEWELLERY_LIGHTS.directional.map((light, index) => <directionalLight key={index} {...light} />)}

			<Environment
				files={JEWELLERY_ENV.files}
				environmentIntensity={JEWELLERY_ENV.environmentIntensity}
				blur={JEWELLERY_ENV.blur}
			/>
		</>
	)
}
