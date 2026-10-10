'use client'

import { JEWELLERY_ENV, JEWELLERY_GL } from '@/lib/jewelleryMaterial'
import { buildAcceptedMountainRing } from '@/lib/acceptedMountainRing'
import { useAcceptedRelief } from '@/lib/useAcceptedRelief'
import { terrainFrameContains } from '@/lib/liveTerrainAnalysis'
import { useAppStore } from '@/store/useAppStore'
import { CANVAS_BACKGROUNDS, usePreferences, useT } from '@/lib/preferences'
import { MATERIALS } from '@favplace/shared'
import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BufferGeometry } from 'three'
import { JewelleryLighting } from './JewelleryLighting'
import { makeMountainRingMaterials } from './mountainRingAppearance'
import { RingOrbitControls } from './RingOrbitControls'

const DISPLAY_SCALE = 0.15
const CAMERA_FRAMING_SCALE = 1.3
const DISPOSE_EVENT = 'favplace:accepted-ring-geometry-disposed'

type AcceptedRingDebug = {
	checksum: string
	vertexCount: number
	indexCount: number
}

function acceptedRingDebug(geometry: BufferGeometry): AcceptedRingDebug {
	const position = geometry.getAttribute('position')
	if (!(position.array instanceof Float32Array)) {
		throw new Error('Accepted mountain ring positions must be Float32')
	}

	let hash = 0x811c9dc5
	const update = (byte: number) => {
		hash ^= byte
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	for (const byte of new Uint8Array(
		position.array.buffer,
		position.array.byteOffset,
		position.array.byteLength,
	)) {
		update(byte)
	}
	const vertexCount = position.count
	const indexCount = geometry.index?.count ?? 0
	for (const count of [vertexCount, indexCount]) {
		for (let shift = 0; shift < 32; shift += 8) update((count >>> shift) & 0xff)
	}

	return {
		checksum: hash.toString(16).padStart(8, '0'),
		vertexCount,
		indexCount,
	}
}

function MountainRing({onStatus}:{onStatus:(status:string)=>void}) {
	const material = useAppStore(s => s.material)
	const surfaceFinish = useAppStore(s => s.surfaceFinish)
	const ringSize = useAppStore(s => s.ringSize)
	const ringWeight = useAppStore(s => s.ringWeight)
	const bandProfile = useAppStore(s => s.bandProfile)
	const shoulderStyle = useAppStore(s => s.shoulderStyle)
	const fine = useAppStore(s=>s.terrainFrame)
	const coarse = useAppStore(s=>s.coarseTerrainFrame)
	const view = useAppStore(s=>s.terrainViewFrame)
	const relief = useAppStore(s=>s.reliefScale)
	const detail = useAppStore(s=>s.reliefDetail)
	const interacting = useAppStore(s=>s.interacting)
	const ringForm = useAppStore(s=>s.ringForm)
	const edgeFine = useAppStore(s=>s.edgeTerrainFrame)
	const edgeCoarse = useAppStore(s=>s.edgeCoarseTerrainFrame)
	const edgeStart = useAppStore(s=>s.edgeStart)
	const options = useMemo(()=>{
	 if(!fine)return null
	 const context=coarse??fine
	 // Раньше на незавершённых ступенях детализация принудительно ставилась в
	 // low — считалось, что так быстрее. Замер показал обратное: low строит
	 // рельеф за 396 мс, medium за 435, а high за 244. Путь предпросмотра идёт
	 // через узловую сетку с бикубикой по 16 узлов на выборку, и это дороже
	 // прямого чтения кадра. Понижение давало и худшую картинку, и большую
	 // задержку, поэтому его больше нет.
	 // A jump outside loaded data holds the last real crop instead of fabricating clamped terrain.
	 const effectiveView=view&&!terrainFrameContains(context.frame,view)?fine.frame:view
	 // Вторая местность только у формы «duo» и только когда её кадр загружен.
	 const edge=ringForm==='duo'&&edgeFine?{fine:edgeFine,coarse:edgeCoarse}:null
	 return {ringDiameter:ringSize,mass:ringWeight,profile:bandProfile,shoulders:shoulderStyle,fine,coarse,view:effectiveView,relief,
	 detail,edge,edgeStart,preview:interacting||!fine.final}
	},
	 [ringSize,ringWeight,bandProfile,shoulderStyle,fine,coarse,view,relief,detail,interacting,ringForm,edgeFine,edgeCoarse,edgeStart])
	const terrain = useAcceptedRelief(options)
	useEffect(()=>onStatus(terrain.error??(terrain.busy?'Уточняем рельеф…':'')),[terrain.error,terrain.busy,onStatus])

	const model = useMemo(
		() =>
			buildAcceptedMountainRing({
				ringDiameter: ringSize,
				mass: ringWeight,
				profile: bandProfile,
				shoulders: shoulderStyle,
			}),
		[ringSize, ringWeight, bandProfile, shoulderStyle],
	)
	const debug = useMemo(() => acceptedRingDebug(model.geometry), [model])
	const disposalState = useRef({
		pending: new Map<BufferGeometry, ReturnType<typeof setTimeout>>(),
		disposed: new WeakSet<BufferGeometry>(),
	})

	useEffect(() => {
		const state = disposalState.current
		const replayTimer = state.pending.get(model.geometry)
		if (replayTimer !== undefined) {
			clearTimeout(replayTimer)
			state.pending.delete(model.geometry)
		}
		return () => {
			const geometry = model.geometry
			const timer = setTimeout(() => {
				state.pending.delete(geometry)
				if (state.disposed.has(geometry)) return
				state.disposed.add(geometry)
				geometry.dispose()
				if (process.env.NODE_ENV !== 'production') {
					window.dispatchEvent(new CustomEvent(DISPOSE_EVENT, { detail: debug }))
				}
			}, 0)
			state.pending.set(geometry, timer)
		}
	}, [debug, model])

	useEffect(() => {
		if (process.env.NODE_ENV === 'production') return
		const debugWindow = window as typeof window & {
			__favplaceAcceptedRingDebug?: AcceptedRingDebug
		}
		debugWindow.__favplaceAcceptedRingDebug = debug
		return () => {
			if (debugWindow.__favplaceAcceptedRingDebug === debug) {
				delete debugWindow.__favplaceAcceptedRingDebug
			}
		}
	}, [debug])

	const ringMaterials = useMemo(() => {
		return makeMountainRingMaterials(MATERIALS[material], surfaceFinish)
	}, [material, surfaceFinish])
	useEffect(
		() => () => {
			ringMaterials.body.dispose()
			ringMaterials.relief.dispose()
		},
		[ringMaterials],
	)

	const bottom =
		(model.geometry.boundingBox?.min.y ?? -ringSize / 2) * DISPLAY_SCALE

	return (
		<>
			<mesh
				geometry={terrain.geometry??model.geometry}
				material={
					terrain.geometry
						? [ringMaterials.body, ringMaterials.relief]
						: ringMaterials.body
				}
				scale={DISPLAY_SCALE}
				castShadow
				receiveShadow
				userData={{ quality: 'accepted-parametric-body' }}
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

function Scene({ cameraTarget,onStatus }: { cameraTarget: [number, number, number],onStatus:(status:string)=>void }) {
	const theme = usePreferences(s => s.theme)
	return (
		<>
			<color attach="background" args={[CANVAS_BACKGROUNDS[theme]]} />
			<JewelleryLighting />
			<MountainRing onStatus={onStatus}/>
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
	const t = useT()
	const theme = usePreferences(s => s.theme)
	const [status,setStatus]=useState('')
	const hasRelief=useAppStore(s=>Boolean(s.terrainFrame))
	const framedCameraPosition = cameraPosition.map(
		(value, index) =>
			cameraTarget[index] +
			(value - cameraTarget[index]) * CAMERA_FRAMING_SCALE,
	) as [number, number, number]

	return (
		<div
			className={`absolute inset-0 ${className}`}
			data-testid="mountain-ring-viewer"
			data-model-source="accepted-parametric-v1"
			data-relief-enabled={String(hasRelief)}
			data-canvas-background={CANVAS_BACKGROUNDS[theme]}
		>
			<Canvas
				frameloop="demand"
				shadows
				camera={{ position: framedCameraPosition, fov: 30 }}
				gl={{
					...JEWELLERY_GL,
					toneMappingExposure: JEWELLERY_ENV.toneMappingExposure,
				}}
				onCreated={({ gl }) => gl.setClearColor(CANVAS_BACKGROUNDS[theme], 1)}
			>
				<Scene cameraTarget={cameraTarget} onStatus={setStatus}/>
			</Canvas>
			{status&&<div role="status" className="pointer-events-none absolute bottom-5 left-5 rounded bg-white/90 px-3 py-2 text-xs text-zinc-600">{t(status)}</div>}
		</div>
	)
}
