'use client'

import { buildReliefPlate } from '@/lib/reliefGeometry'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3)
}

function ReliefPlate() {
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
	const roughness = surfaceFinish === 'matte' ? 0.55 : mat.roughness
	// store reliefHeight is in mm-ish units (~1.5); scale to scene units
	const targetRelief = 0.25 + reliefHeight * 0.18

	const geometry = useMemo(() => {
		if (!heightMap || heightMap.length === 0) return null
		const eased = easeOutCubic(animProgress)
		return buildReliefPlate(heightMap, {
			plateWidth: 2,
			plateLength: 2,
			plateThickness: 0.16,
			reliefHeight: eased * targetRelief,
			gridX: 180,
			gridZ: 180,
		})
	}, [heightMap, animProgress, targetRelief])

	useFrame((_, delta) => {
		if (animRef.current < 1) {
			animRef.current = Math.min(animRef.current + delta * 0.8, 1)
			setAnimProgress(animRef.current)
		}
		if (groupRef.current) {
			groupRef.current.rotation.y += delta * 0.12
		}
	})

	return (
		<group ref={groupRef} rotation={[-0.35, 0, 0]}>
			{geometry && (
				<mesh geometry={geometry} castShadow receiveShadow>
					<meshPhysicalMaterial
						color={mat.color}
						metalness={mat.metalness}
						roughness={roughness}
						envMapIntensity={1.4}
						clearcoat={surfaceFinish === 'polished' ? 0.35 : 0}
						clearcoatRoughness={0.12}
						flatShading={false}
					/>
				</mesh>
			)}
		</group>
	)
}

function Scene() {
	return (
		<>
			<ambientLight intensity={0.45} />
			<directionalLight
				position={[4, 8, 5]}
				intensity={1.8}
				castShadow
				shadow-mapSize-width={1024}
				shadow-mapSize-height={1024}
			/>
			<pointLight position={[-5, 3, -4]} intensity={0.5} color="#fff5e0" />
			<pointLight position={[3, -1, 4]} intensity={0.25} color="#e0f0ff" />

			<ReliefPlate />

			<ContactShadows
				position={[0, -0.02, 0]}
				opacity={0.45}
				scale={6}
				blur={2.4}
				far={4}
			/>

			<Environment preset="studio" />

			<OrbitControls
				enablePan={false}
				minDistance={2}
				maxDistance={7}
				minPolarAngle={Math.PI / 6}
				maxPolarAngle={Math.PI / 2.05}
			/>
		</>
	)
}

export function RingViewer({ className = '' }: { className?: string }) {
	return (
		<div className={`absolute inset-0 ${className}`}>
			<Canvas
				shadows
				camera={{ position: [0, 2.2, 3.4], fov: 32 }}
				gl={{
					antialias: true,
					toneMapping: THREE.ACESFilmicToneMapping,
					toneMappingExposure: 1.15,
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
