'use client'

import { buildTerrainRingGeometry } from '@/lib/ringGeometry'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3)
}

const TUBE_RADIUS = 0.07
const RING_RADIUS = 1

function RingMesh() {
	const meshRef = useRef<THREE.Mesh>(null)
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

	const geometry = useMemo(() => {
		const eased = easeOutCubic(animProgress)
		const currentRelief = eased * targetRelief
		const hm = heightMap && heightMap.length > 0 ? heightMap : null
		return buildTerrainRingGeometry(hm, {
			ringRadius: RING_RADIUS,
			tubeRadius: TUBE_RADIUS,
			reliefHeight: currentRelief,
			tubularSegments: hm ? Math.min(hm.length * 2, 512) : 128,
		})
	}, [heightMap, animProgress, targetRelief])

	useFrame((_, delta) => {
		if (animRef.current < 1) {
			animRef.current = Math.min(animRef.current + delta * 0.7, 1)
			setAnimProgress(animRef.current)
		}
		if (meshRef.current) {
			meshRef.current.rotation.y += delta * 0.15
		}
	})

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

			<group rotation={[Math.PI / 2, 0, 0]}>
				<RingMesh />
			</group>

			<ContactShadows
				position={[0, -1.5, 0]}
				opacity={0.4}
				scale={5}
				blur={2.5}
				far={4}
			/>

			<Environment preset="studio" />

			<OrbitControls
				enablePan={false}
				minDistance={1.8}
				maxDistance={6}
				minPolarAngle={Math.PI / 8}
				maxPolarAngle={Math.PI / 1.3}
			/>
		</>
	)
}

export function RingViewer({ className = '' }: { className?: string }) {
	return (
		<div className={`absolute inset-0 ${className}`}>
			<Canvas
				shadows
				camera={{ position: [0, 1, 3.5], fov: 35 }}
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
