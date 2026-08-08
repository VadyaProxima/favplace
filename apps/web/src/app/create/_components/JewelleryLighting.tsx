'use client'

import { JEWELLERY_ENV } from '@/lib/jewelleryMaterial'
import { Environment } from '@react-three/drei'

/**
 * Custom nature HDRI + warm key lights so the top face stays bright.
 */
export function JewelleryLighting() {
	return (
		<>
			<hemisphereLight args={['#fff8ee', '#d5d8dc', 0.85]} />
			<ambientLight intensity={0.45} />
			<directionalLight
				position={[1.5, 14, 2]}
				intensity={2.8}
				color="#fff6e0"
				castShadow
			/>
			<directionalLight position={[7, 5, 5]} intensity={1.2} color="#ffe8c4" />
			<directionalLight position={[-6, 4, -3]} intensity={0.55} color="#eef1ff" />
			<directionalLight position={[0, 2, -8]} intensity={0.45} color="#ffffff" />

			<Environment
				files={JEWELLERY_ENV.files}
				environmentIntensity={JEWELLERY_ENV.environmentIntensity}
				blur={JEWELLERY_ENV.blur}
			/>
		</>
	)
}
