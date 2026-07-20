'use client'

import { getRingBottomY, SIGNET_GLB_PATH, prepareSignetFromGlb } from '@/lib/signetFromGlb'
import { smoothHeightGridByDetail } from '@/lib/reliefSmoothing'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import {
	ContactShadows,
	Environment,
	OrbitControls,
	useGLTF,
} from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

function SignetRing() {
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const reliefHeight = useAppStore(s => s.reliefHeight)
	const reliefDetail = useAppStore(s => s.reliefDetail)

	const gltf = useGLTF(SIGNET_GLB_PATH)
	const mat = MATERIALS[material]
	const polished = surfaceFinish === 'polished'
	const roughness = polished ? mat.roughness * 0.85 : 0.48

	const smoothedHeightMap = useMemo(
		() => (heightMap ? smoothHeightGridByDetail(heightMap, reliefDetail) : null),
		[heightMap, reliefDetail],
	)

	const { ring, bottomY } = useMemo(() => {
		const r = prepareSignetFromGlb(gltf, smoothedHeightMap, reliefHeight, {
			color: mat.color,
			metalness: mat.metalness,
			roughness,
			polished,
		})
		return { ring: r, bottomY: getRingBottomY(r) }
	}, [gltf, smoothedHeightMap, reliefHeight, mat, roughness, polished])

	return (
		<>
			<primitive object={ring} />
			<ContactShadows
				position={[0, bottomY - 0.02, 0]}
				opacity={0.35}
				scale={7}
				blur={2.8}
				far={3.5}
			/>
		</>
	)
}

function Scene() {
	return (
		<>
			<color attach="background" args={['#f4f4f5']} />
			<ambientLight intensity={0.35} />
			<directionalLight
				position={[2.5, 7, 5]}
				intensity={1.8}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
			/>
			<directionalLight position={[-5, 3, -2]} intensity={0.55} color="#fff0dc" />
			<directionalLight position={[0, -1, 4]} intensity={0.25} color="#e8eeff" />

			<Suspense fallback={null}>
				<SignetRing />
			</Suspense>

			<Environment preset="city" />

			<OrbitControls
				enablePan={false}
				minDistance={2.6}
				maxDistance={7.5}
				minPolarAngle={0.2}
				maxPolarAngle={Math.PI / 1.85}
				target={[0, 0.55, 0]}
				enableDamping
			/>
		</>
	)
}

export function RingViewer({ className = '' }: { className?: string }) {
	return (
		<div className={`absolute inset-0 ${className}`}>
			<Canvas
				shadows
				camera={{ position: [1.5, 3.1, 3.2], fov: 30 }}
				gl={{
					antialias: true,
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 1.05,
				}}
			>
				<Scene />
			</Canvas>
		</div>
	)
}

useGLTF.preload(SIGNET_GLB_PATH)
