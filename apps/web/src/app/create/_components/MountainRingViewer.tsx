'use client'

import { makeJewelleryMaterial, JEWELLERY_ENV, JEWELLERY_GL } from '@/lib/jewelleryMaterial'
import { buildDemoMountainHeightMap } from '@/lib/mountainSignet'
import { calibratedReliefScale } from '@/lib/reliefCalibration'
import {
	createInteractiveMountainSignet,
	updateInteractiveMountainSignet,
} from '@/lib/referenceMountainSignet'
import {
	createInteractiveReliefHostGeometry,
	createInteractiveReliefSurface,
	syncInteractiveReliefHostGeometry,
	updateInteractiveReliefSurface,
} from '@/lib/interactiveMountainReliefSurface'
import type { TerrainFrame } from '@/lib/referenceSignetTerrain'
import { useAppStore, type ReliefDetail } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { JewelleryLighting } from './JewelleryLighting'
import { RingOrbitControls } from './RingOrbitControls'

const DISPLAY_SCALE = 0.15
const DETAIL_SMOOTHING: Record<ReliefDetail, 0 | 2 | 4> = {
	low: 4,
	medium: 2,
	high: 0,
}

function demoTerrainFrame(): TerrainFrame {
	const data = buildDemoMountainHeightMap(256)
	return {
		data,
		size: data.length,
		minElev: 0,
		maxElev: 1,
		frame: { lat: 0, lng: 0, radiusKm: 1, bearing: 0 },
		final: true,
	}
}

function MountainRing() {
	const terrainFrame = useAppStore(s => s.terrainFrame)
	const coarseTerrainFrame = useAppStore(s => s.coarseTerrainFrame)
	const terrainViewFrame = useAppStore(s => s.terrainViewFrame)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const reliefScale = useAppStore(s => s.reliefScale)
	const reliefDetail = useAppStore(s => s.reliefDetail)
	const ringSize = useAppStore(s => s.ringSize)
	const ringWeight = useAppStore(s => s.ringWeight)
	const bandProfile = useAppStore(s => s.bandProfile)
	const shoulderStyle = useAppStore(s => s.shoulderStyle)

	const model = useMemo(() => {
		return createInteractiveMountainSignet({
			ringDiameter: ringSize,
			weight: ringWeight,
			bandProfile,
			shoulderStyle,
		})
	}, [ringSize, ringWeight, bandProfile, shoulderStyle])
	const renderedHost = useMemo(
		() => createInteractiveReliefHostGeometry(model),
		[model],
	)
	const reliefSurface = useMemo(
		() => createInteractiveReliefSurface(model, reliefDetail),
		[model, reliefDetail],
	)

	const displayModel = useMemo(() => {
		const fine = terrainFrame ?? demoTerrainFrame()
		const options = {
			fine,
			coarse: coarseTerrainFrame,
			view: terrainViewFrame ?? fine.frame,
			relief: calibratedReliefScale(reliefScale),
			smoothing: DETAIL_SMOOTHING[reliefDetail],
		} as const
		updateInteractiveMountainSignet(model, options)
		syncInteractiveReliefHostGeometry(renderedHost, model)
		updateInteractiveReliefSurface(reliefSurface, model, options)
		return { host: renderedHost, relief: reliefSurface }
	}, [
		model,
		renderedHost,
		reliefSurface,
		terrainFrame,
		coarseTerrainFrame,
		terrainViewFrame,
		reliefScale,
		reliefDetail,
	])

	useEffect(() => () => model.geometry.dispose(), [model])
	useEffect(() => () => renderedHost.geometry.dispose(), [renderedHost])
	useEffect(() => () => reliefSurface.geometry.dispose(), [reliefSurface])

	const jewelleryMaterial = useMemo(() => {
		const source = MATERIALS[material]
		return makeJewelleryMaterial({
			color: source.color,
			metalness: source.metalness,
			roughness: source.roughness,
			polished: surfaceFinish === 'polished',
			variant: 'band',
		})
	}, [material, surfaceFinish])
	useEffect(() => () => jewelleryMaterial.dispose(), [jewelleryMaterial])

	const bottom =
		(displayModel.host.geometry.boundingBox?.min.y ?? -ringSize / 2) * DISPLAY_SCALE

	return (
		<>
			<mesh
				geometry={displayModel.host.geometry}
				material={jewelleryMaterial}
				scale={DISPLAY_SCALE}
				castShadow
				receiveShadow
				userData={{ quality: 'interactive-host' }}
			/>
			<mesh
				geometry={displayModel.relief.geometry}
				material={jewelleryMaterial}
				scale={DISPLAY_SCALE}
				castShadow
				receiveShadow
				userData={{
					quality: 'interactive-relief',
					gridSegments: displayModel.relief.gridSegments,
				}}
			/>
			<ContactShadows
				position={[0, bottom - 0.025, 0]}
				opacity={0.32}
				scale={6}
				blur={2.8}
				far={4}
			/>
		</>
	)
}

function Scene({ cameraTarget }: { cameraTarget: [number, number, number] }) {
	return (
		<>
			<color attach="background" args={['#f4f4f5']} />
			<JewelleryLighting />
			<MountainRing />
			<RingOrbitControls
				minDistance={2.2}
				maxDistance={12}
				minPolarAngle={0.08}
				maxPolarAngle={Math.PI - 0.08}
				target={cameraTarget}
			/>
		</>
	)
}

export function MountainRingViewer({
	className = '',
	cameraPosition = [-3.6, 2.8, 4.2] as [number, number, number],
	cameraTarget = [0, 0.35, 0] as [number, number, number],
}: {
	className?: string
	cameraPosition?: [number, number, number]
	cameraTarget?: [number, number, number]
}) {
	return (
		<div className={`absolute inset-0 ${className}`} data-testid="mountain-ring-viewer">
			<Canvas
				shadows
				camera={{ position: cameraPosition, fov: 30 }}
				gl={{
					...JEWELLERY_GL,
					toneMappingExposure: JEWELLERY_ENV.toneMappingExposure,
				}}
				onCreated={({ gl }) => gl.setClearColor('#f4f4f5', 1)}
			>
				<Scene cameraTarget={cameraTarget} />
			</Canvas>
		</div>
	)
}
