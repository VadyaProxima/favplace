'use client'

import {
	buildDiscRing,
	buildPlugRing,
	getDiscRingBottomY,
} from '@/lib/discRing'
import { useExportTarget } from '@/lib/exportTarget'
import { makeJewelleryMaterial, JEWELLERY_ENV, JEWELLERY_GL } from '@/lib/jewelleryMaterial'
import { buildDemoMountainHeightMap } from '@/lib/mountainSignet'
import { calibratedReliefHeight } from '@/lib/reliefCalibration'
import { smoothHeightGridByDetail } from '@/lib/reliefSmoothing'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { JewelleryLighting } from './JewelleryLighting'
import { RingOrbitControls } from './RingOrbitControls'

function DiscOrPlugRing({ mode }: { mode: 'disc' | 'plug' }) {
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const reliefHeight = useAppStore(s => s.reliefHeight)
	const reliefDetail = useAppStore(s => s.reliefDetail)
	const twoTone = useAppStore(s => s.mountainTwoTone)

	const mat = MATERIALS[material]
	const polished = surfaceFinish === 'polished'
	const reliefGrid = useMemo(
		() =>
			smoothHeightGridByDetail(
				heightMap ?? buildDemoMountainHeightMap(140),
				reliefDetail,
			),
		[heightMap, reliefDetail],
	)

	const { mesh, bottomY } = useMemo(() => {
		const geometry =
			mode === 'plug'
				? buildPlugRing(reliefGrid, calibratedReliefHeight('plug', reliefHeight))
				: buildDiscRing(reliefGrid, calibratedReliefHeight('disc', reliefHeight))

		const bandMat = makeJewelleryMaterial({
			color: mat.color,
			metalness: mat.metalness,
			roughness: mat.roughness,
			polished,
			variant: 'band',
		})

		const terrainMat = twoTone
			? makeJewelleryMaterial({
					color: mat.color,
					metalness: mat.metalness,
					roughness: mat.roughness,
					polished,
					variant: 'frost',
				})
			: makeJewelleryMaterial({
					color: mat.color,
					metalness: mat.metalness,
					roughness: mat.roughness,
					polished,
					variant: 'terrain',
				})

		const m = new THREE.Mesh(geometry, [bandMat, terrainMat])
		m.castShadow = true
		m.receiveShadow = true

		geometry.computeBoundingBox()
		const box = geometry.boundingBox!
		const cx = (box.min.x + box.max.x) / 2
		const cy = (box.min.y + box.max.y) / 2
		const cz = (box.min.z + box.max.z) / 2
		const lift = mode === 'plug' ? 0.5 : 0.55
		m.position.set(-cx, -cy + lift, -cz)

		return { mesh: m, bottomY: getDiscRingBottomY(geometry) - cy + lift }
	}, [mode, reliefGrid, reliefHeight, mat, polished, twoTone])

	useExportTarget(mesh)

	return (
		<>
			<primitive object={mesh} />
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
	mode,
	cameraTarget,
}: {
	mode: 'disc' | 'plug'
	cameraTarget: [number, number, number]
}) {
	return (
		<>
			<color attach="background" args={['#f4f4f5']} />
			<JewelleryLighting />

			<Suspense fallback={null}>
				<DiscOrPlugRing mode={mode} />
			</Suspense>

			<RingOrbitControls
				minDistance={0.85}
				maxDistance={12}
				minPolarAngle={0.15}
				maxPolarAngle={Math.PI / 1.75}
				target={cameraTarget}
			/>
		</>
	)
}

export function DiscRingViewer({
	className = '',
	mode = 'disc',
	cameraPosition = [-2.15, 1.75, 2.65] as [number, number, number],
	cameraTarget = [0, 0.5, 0] as [number, number, number],
}: {
	className?: string
	mode?: 'disc' | 'plug'
	cameraPosition?: [number, number, number]
	cameraTarget?: [number, number, number]
}) {
	return (
		<div
			className={`absolute inset-0 ${className}`}
			data-testid={mode === 'plug' ? 'plug-ring-viewer' : 'disc-ring-viewer'}
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
				<Scene mode={mode} cameraTarget={cameraTarget} />
			</Canvas>
		</div>
	)
}
