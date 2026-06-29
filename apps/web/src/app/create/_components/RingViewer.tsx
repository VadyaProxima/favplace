'use client'

import { buildFlatTorus, buildTerrainRingGeometry } from '@/lib/ringGeometry'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

function AnimatedRingMesh() {
	const meshRef = useRef<THREE.Mesh>(null)
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const ringWidth = useAppStore(s => s.ringWidth)
	const reliefHeight = useAppStore(s => s.reliefHeight)

	const [animProgress, setAnimProgress] = useState(0)
	const animRef = useRef(0)

	const tubeRadius = ringWidth / 10
	const targetRelief = reliefHeight / 20

	useEffect(() => {
		animRef.current = 0
		setAnimProgress(0)
	}, [heightMap])

	const geometry = (() => {
		if (!heightMap || heightMap.length === 0) {
			return buildFlatTorus(1, tubeRadius)
		}
		const eased = easeOutCubic(animProgress)
		const currentRelief = eased * targetRelief
		return buildTerrainRingGeometry(heightMap, {
			ringRadius: 1,
			tubeRadius,
			reliefHeight: currentRelief,
			tubularSegments: Math.min(heightMap.length * 2, 512),
			radialSegments: 64,
		})
	})()

	useFrame((_, delta) => {
		if (animRef.current < 1) {
			animRef.current = Math.min(animRef.current + delta * 0.7, 1)
			setAnimProgress(animRef.current)
		}
		if (meshRef.current) {
			meshRef.current.rotation.y += delta * 0.15
		}
	})

	const mat = MATERIALS[material]
	const roughness = surfaceFinish === 'matte' ? 0.6 : mat.roughness

	return (
		<mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
			<meshPhysicalMaterial
				color={mat.color}
				metalness={mat.metalness}
				roughness={roughness}
				envMapIntensity={1.5}
				clearcoat={surfaceFinish === 'polished' ? 0.3 : 0}
				clearcoatRoughness={0.1}
			/>
		</mesh>
	)
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3)
}

function Scene() {
	return (
		<>
			<ambientLight intensity={0.3} />
			<directionalLight
				position={[5, 8, 5]}
				intensity={1.2}
				castShadow
				shadow-mapSize-width={1024}
				shadow-mapSize-height={1024}
			/>
			<pointLight position={[-5, 3, -5]} intensity={0.5} color="#fff5e0" />

			<AnimatedRingMesh />

			<ContactShadows
				position={[0, -1.2, 0]}
				opacity={0.5}
				scale={5}
				blur={2}
				far={4}
			/>

			<Environment preset="studio" />

			<OrbitControls
				enablePan={false}
				minDistance={1.5}
				maxDistance={5}
				minPolarAngle={Math.PI / 6}
				maxPolarAngle={Math.PI / 1.5}
			/>
		</>
	)
}

export function RingViewer({ className = '' }: { className?: string }) {
	return (
		<div className={`relative ${className}`}>
			<Canvas
				shadows
				camera={{ position: [0, 1.5, 3], fov: 40 }}
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
