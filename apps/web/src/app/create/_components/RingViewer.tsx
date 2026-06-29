'use client'

import {
	buildRingBandGeometry,
	buildTerrainInsertGeometry,
} from '@/lib/ringGeometry'
import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3)
}

function RingGroup() {
	const groupRef = useRef<THREE.Group>(null)
	const heightMap = useAppStore(s => s.heightMap)
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const ringWidth = useAppStore(s => s.ringWidth)
	const reliefHeight = useAppStore(s => s.reliefHeight)

	const [animProgress, setAnimProgress] = useState(0)
	const animRef = useRef(0)

	useEffect(() => {
		animRef.current = 0
		setAnimProgress(0)
	}, [heightMap])

	const tubeRadius = ringWidth / 10
	const mat = MATERIALS[material]
	const roughness = surfaceFinish === 'matte' ? 0.6 : mat.roughness
	const targetRelief = reliefHeight / 20

	const bandGeometry = useMemo(
		() =>
			buildRingBandGeometry({
				ringRadius: 1,
				tubeRadius,
				tubularSegments: 128,
			}),
		[tubeRadius],
	)

	const insertGeometry = useMemo(() => {
		if (!heightMap || heightMap.length === 0) return null
		const eased = easeOutCubic(animProgress)
		const currentRelief = eased * targetRelief
		return buildTerrainInsertGeometry(heightMap, {
			ringRadius: 1,
			tubeRadius,
			reliefHeight: currentRelief,
			tubularSegments: Math.min(heightMap.length * 2, 512),
		})
	}, [heightMap, animProgress, tubeRadius, targetRelief])

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
		<group ref={groupRef} rotation={[Math.PI / 2, 0, 0]}>
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

			{insertGeometry && (
				<mesh geometry={insertGeometry} castShadow receiveShadow>
					<meshPhysicalMaterial
						color={mat.color}
						metalness={mat.metalness * 0.85}
						roughness={Math.min(roughness + 0.15, 0.8)}
						envMapIntensity={1.2}
						clearcoat={surfaceFinish === 'polished' ? 0.1 : 0}
						clearcoatRoughness={0.2}
					/>
				</mesh>
			)}
		</group>
	)
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

			<RingGroup />

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
