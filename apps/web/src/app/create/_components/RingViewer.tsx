'use client'

import { buildRingBand, buildTerrainPlate } from '@/lib/ringGeometry'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3)
}

const RING_RADIUS = 1
const TUBE_RADIUS = 0.07

function RingGroup() {
	const groupRef = useRef<THREE.Group>(null)
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const reliefHeight = useAppStore(s => s.reliefHeight)

	const [animProgress, setAnimProgress] = useState(0)
	const animRef = useRef(0)

	useEffect(() => {
		animRef.current = 0
		setAnimProgress(0)
	}, [heightMap])

	const mat = MATERIALS[material]
	const roughness = surfaceFinish === 'matte' ? 0.6 : mat.roughness
	const targetRelief = reliefHeight / 20

	const bandGeometry = useMemo(
		() => buildRingBand(RING_RADIUS, TUBE_RADIUS),
		[],
	)

	const plateGeometry = useMemo(() => {
		if (!heightMap || heightMap.length === 0) return null
		const eased = easeOutCubic(animProgress)
		const currentRelief = eased * targetRelief
		return buildTerrainPlate(heightMap, {
			ringRadius: RING_RADIUS,
			tubeRadius: TUBE_RADIUS,
			plateWidth: 0.14,
			plateLength: 0.45,
			plateThickness: 0.012,
			reliefHeight: currentRelief,
			gridX: 64,
			gridZ: 128,
		})
	}, [heightMap, animProgress, targetRelief])

	useFrame((_, delta) => {
		if (animRef.current < 1) {
			animRef.current = Math.min(animRef.current + delta * 0.7, 1)
			setAnimProgress(animRef.current)
		}
		if (groupRef.current) {
			groupRef.current.rotation.y += delta * 0.15
		}
	})

	return (
		<group ref={groupRef}>
			<mesh geometry={bandGeometry} castShadow receiveShadow>
				<meshPhysicalMaterial
					color={mat.color}
					metalness={mat.metalness}
					roughness={roughness}
					envMapIntensity={1.5}
					clearcoat={surfaceFinish === 'polished' ? 0.3 : 0}
					clearcoatRoughness={0.1}
				/>
			</mesh>

			{plateGeometry && (
				<mesh geometry={plateGeometry} castShadow receiveShadow>
					<meshPhysicalMaterial
						color={mat.color}
						metalness={mat.metalness}
						roughness={roughness}
						envMapIntensity={1.5}
						clearcoat={surfaceFinish === 'polished' ? 0.3 : 0}
						clearcoatRoughness={0.1}
					/>
				</mesh>
			)}
		</group>
	)
}

function Scene() {
	return (
		<>
			<ambientLight intensity={0.4} />
			<directionalLight
				position={[5, 8, 5]}
				intensity={1.5}
				castShadow
				shadow-mapSize-width={1024}
				shadow-mapSize-height={1024}
			/>
			<pointLight position={[-5, 3, -5]} intensity={0.6} color="#fff5e0" />
			<pointLight position={[3, -2, 4]} intensity={0.3} color="#e0f0ff" />

			<RingGroup />

			<ContactShadows
				position={[0, -0.5, 0]}
				opacity={0.4}
				scale={5}
				blur={2.5}
				far={4}
			/>

			<Environment preset="studio" />

			<OrbitControls
				enablePan={false}
				minDistance={1.5}
				maxDistance={5}
				minPolarAngle={Math.PI / 6}
				maxPolarAngle={Math.PI / 2.2}
			/>
		</>
	)
}

export function RingViewer({ className = '' }: { className?: string }) {
	return (
		<div className={`absolute inset-0 ${className}`}>
			<Canvas
				shadows
				camera={{ position: [1.5, 1.5, 2.5], fov: 35 }}
				gl={{
					antialias: true,
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 1.2,
				}}
			>
				<Scene />
			</Canvas>
			<div className="pointer-events-none absolute bottom-3 left-3 rounded bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400 backdrop-blur">
				Вращайте мышью • Скролл для зума
			</div>
		</div>
	)
}
