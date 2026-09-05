'use client'

import {
	BASIC_RING_GLB_PATH,
	getBasicRingBottomY,
	prepareBasicRingFromGlb,
	type BasicRingVariant,
} from '@/lib/basicRingFromGlb'
import { useExportTarget } from '@/lib/exportTarget'
import { JEWELLERY_ENV, JEWELLERY_GL } from '@/lib/jewelleryMaterial'
import { calibratedReliefHeight } from '@/lib/reliefCalibration'
import { smoothHeightGridByDetail } from '@/lib/reliefSmoothing'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { JewelleryLighting } from './JewelleryLighting'
import { RingOrbitControls } from './RingOrbitControls'

function BasicRing({ variant }: { variant: BasicRingVariant }) {
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const reliefHeight = useAppStore(s => s.reliefHeight)
	const reliefDetail = useAppStore(s => s.reliefDetail)

	const gltf = useGLTF(BASIC_RING_GLB_PATH)
	const mat = MATERIALS[material]
	const polished = surfaceFinish === 'polished'
	const roughness = polished ? mat.roughness * 0.55 : 0.4

	const reliefGrid = useMemo(
		() => (heightMap ? smoothHeightGridByDetail(heightMap, reliefDetail) : null),
		[heightMap, reliefDetail],
	)

	const { ring, bottomY } = useMemo(() => {
		const r = prepareBasicRingFromGlb(gltf, variant, reliefGrid, calibratedReliefHeight(variant, reliefHeight), {
			color: mat.color,
			metalness: mat.metalness,
			roughness,
			polished,
		})
		return { ring: r, bottomY: getBasicRingBottomY(r) }
	}, [gltf, variant, reliefGrid, reliefHeight, mat, roughness, polished])

	useExportTarget(ring)

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

function Scene({
	variant,
	cameraTarget,
}: {
	variant: BasicRingVariant
	cameraTarget: [number, number, number]
}) {
	return (
		<>
			<color attach="background" args={['#f4f4f5']} />
			<JewelleryLighting />
			<Suspense fallback={null}>
				<BasicRing variant={variant} />
			</Suspense>
			<RingOrbitControls
				minDistance={0.85}
				maxDistance={12}
				minPolarAngle={0.2}
				maxPolarAngle={Math.PI / 1.85}
				target={cameraTarget}
			/>
		</>
	)
}

export function BasicRingViewer({
	className = '',
	variant,
	cameraPosition = [-2.15, 1.75, 2.65] as [number, number, number],
	cameraTarget = [0, 0.5, 0] as [number, number, number],
}: {
	className?: string
	variant: BasicRingVariant
	cameraPosition?: [number, number, number]
	cameraTarget?: [number, number, number]
}) {
	return (
		<div
			className={`absolute inset-0 ${className}`}
			data-testid={`basic-ring-${variant}`}
		>
			<Canvas
				shadows
				camera={{ position: cameraPosition, fov: 30 }}
				gl={{
					...JEWELLERY_GL,
					toneMappingExposure: JEWELLERY_ENV.toneMappingExposure,
				}}
				onCreated={({ gl }) => {
					gl.setClearColor('#f4f4f5', 1)
				}}
			>
				<Scene variant={variant} cameraTarget={cameraTarget} />
			</Canvas>
		</div>
	)
}

useGLTF.preload(BASIC_RING_GLB_PATH)
