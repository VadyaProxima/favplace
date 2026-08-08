'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { RingForm } from '@/store/useAppStore'

export interface FlyTarget {
	lng: number
	lat: number
	/** bump to force a fly even if coords are equal */
	key: number
}

/** Visual shape of the map selection frame (matches ring insert). */
export type ReliefFrameShape = 'square' | 'circle' | 'oval' | 'rect'

export function ringFormToFrameShape(form: RingForm): ReliefFrameShape {
	switch (form) {
		case 'circle':
		case 'disc':
		case 'plug':
			return 'circle'
		case 'oval':
		case 'classic':
			return 'oval'
		case 'bar':
			return 'rect'
		case 'square':
		case 'mountain':
		default:
			return 'square'
	}
}

/** width / height of the frame bounding box */
function frameAspect(shape: ReliefFrameShape): number {
	switch (shape) {
		case 'oval':
			return 1.35
		case 'rect':
			return 2.15
		case 'circle':
		case 'square':
		default:
			return 1
	}
}

function frameRadiusCss(shape: ReliefFrameShape): string {
	switch (shape) {
		case 'circle':
		case 'oval':
			return '50%'
		case 'rect':
			return '6px'
		case 'square':
		default:
			return '2px'
	}
}

interface TerrainMapProps {
	/** external "go here" command (search result pick) */
	target: FlyTarget
	/** selection half of the longer side in meters */
	radius: number
	onCenterChange: (lng: number, lat: number) => void
	onRadiusChange: (radius: number) => void
	/** ring insert shape → frame geometry */
	frameShape?: ReliefFrameShape
}

export type MapStyleType = 'satellite' | 'street' | 'terrain'

const STYLE_TILES: Record<
	MapStyleType,
	{ name: string; url: string; maxzoom: number }
> = {
	satellite: {
		name: 'Спутник',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		maxzoom: 19,
	},
	street: {
		name: 'Схема',
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
		maxzoom: 18,
	},
	terrain: {
		name: 'Рельеф',
		url: 'https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
		maxzoom: 15,
	},
}

const MIN_RADIUS = 100
const MAX_RADIUS = 20000
const FIT_FRACTION = 0.45

function buildStyle(type: MapStyleType) {
	return {
		version: 8 as const,
		sources: {
			basemap: {
				type: 'raster' as const,
				tiles: [STYLE_TILES[type].url],
				tileSize: 256,
				maxzoom: STYLE_TILES[type].maxzoom,
				attribution: '© Esri',
			},
		},
		layers: [{ id: 'basemap', type: 'raster' as const, source: 'basemap' }],
	}
}

function formatSide(meters: number) {
	return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toFixed(1)} км`
}

/**
 * Crosshair-style selection: the frame is FIXED at the viewport center and
 * the map moves underneath. Frame outline follows the selected ring form
 * (square / circle / oval / elongated rect).
 */
export function TerrainMap({
	target,
	radius,
	onCenterChange,
	onRadiusChange,
	frameShape = 'square',
}: TerrainMapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<maplibregl.Map | null>(null)
	const frameElRef = useRef<HTMLDivElement>(null)
	const labelElRef = useRef<HTMLDivElement>(null)
	const borderElRef = useRef<HTMLDivElement>(null)

	const onCenterChangeRef = useRef(onCenterChange)
	onCenterChangeRef.current = onCenterChange
	const onRadiusChangeRef = useRef(onRadiusChange)
	onRadiusChangeRef.current = onRadiusChange
	const frameShapeRef = useRef(frameShape)
	frameShapeRef.current = frameShape

	const [styleType, setStyleType] = useState<MapStyleType>('satellite')
	const [mapReady, setMapReady] = useState(false)

	const radiusRef = useRef(radius)
	const lastEmittedRadiusRef = useRef(radius)
	const rafRef = useRef<number | null>(null)
	const resizeDragRef = useRef<{ pointerId: number } | null>(null)

	const pxPer1000m = () => {
		const map = mapRef.current
		if (!map) return 1
		const c = map.getCenter()
		const p1 = map.project([c.lng, c.lat])
		const p2 = map.project([c.lng, c.lat + 1000 / 111_320])
		return Math.abs(p1.y - p2.y) || 1
	}

	const applyFrameSize = () => {
		const el = frameElRef.current
		if (!el) return
		const shape = frameShapeRef.current
		const aspect = frameAspect(shape)
		const longPx = ((radiusRef.current * 2) / 1000) * pxPer1000m()
		el.style.width = `${longPx}px`
		el.style.height = `${longPx / aspect}px`
		if (borderElRef.current) {
			borderElRef.current.style.borderRadius = frameRadiusCss(shape)
		}
		if (labelElRef.current) {
			const wM = radiusRef.current * 2
			const hM = wM / aspect
			labelElRef.current.textContent = `${formatSide(wM)} × ${formatSide(hM)}`
		}
	}

	const scheduleFrameSize = () => {
		if (rafRef.current !== null) return
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null
			applyFrameSize()
		})
	}

	const emitCenter = () => {
		const map = mapRef.current
		if (!map) return
		const c = map.getCenter()
		onCenterChangeRef.current(c.lng, c.lat)
	}

	const fitZoomToFrame = (center?: [number, number], jump = false) => {
		const map = mapRef.current
		const container = containerRef.current
		if (!map || !container) return
		const rect = container.getBoundingClientRect()
		const aspect = frameAspect(frameShapeRef.current)
		const desiredLongPx = FIT_FRACTION * Math.min(rect.width, rect.height * aspect)
		const currentLongPx = ((radiusRef.current * 2) / 1000) * pxPer1000m()
		if (currentLongPx <= 0) return
		const zoom = Math.min(
			STYLE_TILES[styleType].maxzoom,
			Math.max(2, map.getZoom() + Math.log2(desiredLongPx / currentLongPx)),
		)
		const opts = { center: center ?? map.getCenter(), zoom }
		if (jump) map.jumpTo(opts)
		else map.easeTo({ ...opts, duration: 350 })
	}

	useEffect(() => {
		if (!containerRef.current || mapRef.current) return
		const map = new maplibregl.Map({
			container: containerRef.current,
			style: buildStyle(styleType),
			center: [target.lng, target.lat],
			zoom: 12,
			minZoom: 2,
			maxZoom: 19,
			attributionControl: false,
		})
		mapRef.current = map
		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

		map.on('move', scheduleFrameSize)
		map.on('moveend', emitCenter)

		map.on('load', () => {
			map.resize()
			fitZoomToFrame([target.lng, target.lat], true)
			applyFrameSize()
			setMapReady(true)
			emitCenter()
		})

		map.on('click', e => {
			map.easeTo({ center: e.lngLat, duration: 300 })
		})

		const ro = new ResizeObserver(() => {
			map.resize()
			scheduleFrameSize()
		})
		ro.observe(containerRef.current)

		return () => {
			ro.disconnect()
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
			try {
				map.remove()
			} catch {}
			mapRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		const onMove = (e: PointerEvent) => {
			const st = resizeDragRef.current
			const map = mapRef.current
			const container = containerRef.current
			if (!st || !map || !container || e.pointerId !== st.pointerId) return
			const rect = container.getBoundingClientRect()
			const cx = rect.width / 2
			const cy = rect.height / 2
			const px = e.clientX - rect.left
			const py = e.clientY - rect.top
			const aspect = frameAspect(frameShapeRef.current)
			const dx = Math.abs(px - cx)
			const dy = Math.abs(py - cy) * aspect
			const halfLongPx = Math.max(dx, dy)
			radiusRef.current = Math.min(
				MAX_RADIUS,
				Math.max(MIN_RADIUS, (halfLongPx / pxPer1000m()) * 1000),
			)
			applyFrameSize()
			e.preventDefault()
		}
		const onUp = (e: PointerEvent) => {
			const st = resizeDragRef.current
			if (!st || e.pointerId !== st.pointerId) return
			resizeDragRef.current = null
			mapRef.current?.dragPan.enable()
			const r = Math.round(radiusRef.current)
			lastEmittedRadiusRef.current = r
			onRadiusChangeRef.current(r)
		}
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onUp)
		window.addEventListener('pointercancel', onUp)
		return () => {
			window.removeEventListener('pointermove', onMove)
			window.removeEventListener('pointerup', onUp)
			window.removeEventListener('pointercancel', onUp)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		mapRef.current?.setStyle(buildStyle(styleType), { diff: false })
	}, [styleType])

	const lastTargetKeyRef = useRef(target.key)
	useEffect(() => {
		if (target.key === lastTargetKeyRef.current) return
		lastTargetKeyRef.current = target.key
		fitZoomToFrame([target.lng, target.lat])
		scheduleFrameSize()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [target.key])

	useEffect(() => {
		radiusRef.current = radius
		if (radius !== lastEmittedRadiusRef.current) {
			lastEmittedRadiusRef.current = radius
			fitZoomToFrame()
		}
		scheduleFrameSize()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [radius])

	useEffect(() => {
		frameShapeRef.current = frameShape
		scheduleFrameSize()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frameShape])

	const onHandlePointerDown = (e: React.PointerEvent) => {
		const map = mapRef.current
		if (!map) return
		e.preventDefault()
		e.stopPropagation()
		map.dragPan.disable()
		resizeDragRef.current = { pointerId: e.pointerId }
	}

	const handleCursor: Record<string, string> = {
		'left-0 top-0': 'nwse-resize',
		'right-0 top-0': 'nesw-resize',
		'left-0 bottom-0': 'nesw-resize',
		'right-0 bottom-0': 'nwse-resize',
	}

	const aspect = frameAspect(frameShape)
	const labelW = radius * 2
	const labelH = labelW / aspect

	return (
		<div className="relative h-full w-full overflow-hidden bg-zinc-200">
			<div ref={containerRef} className="absolute inset-0 h-full w-full" />

			<div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-md border border-black/10 bg-white/95 shadow-sm backdrop-blur">
				{(Object.keys(STYLE_TILES) as MapStyleType[]).map(t => (
					<button
						key={t}
						onClick={() => setStyleType(t)}
						className={`px-2.5 py-1.5 text-[11px] font-medium transition ${
							styleType === t
								? 'bg-zinc-900 text-white'
								: 'text-zinc-600 hover:bg-zinc-100'
						}`}
					>
						{STYLE_TILES[t].name}
					</button>
				))}
			</div>

			<div
				ref={frameElRef}
				className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none transition-[border-radius] duration-200 ${mapReady ? '' : 'invisible'}`}
			>
				<div
					ref={borderElRef}
					className="absolute inset-0 border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
					style={{ borderRadius: frameRadiusCss(frameShape) }}
				/>

				{(['left-0 top-0', 'right-0 top-0', 'left-0 bottom-0', 'right-0 bottom-0'] as const).map(
					pos => (
						<div
							key={pos}
							className={`pointer-events-auto absolute ${pos} h-4 w-4 touch-none`}
							style={{
								cursor: handleCursor[pos],
								transform: `translate(${pos.includes('left') ? '-50%' : '50%'}, ${pos.includes('top') ? '-50%' : '50%'})`,
							}}
							onPointerDown={onHandlePointerDown}
						>
							<div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-black/30 bg-white shadow-sm" />
						</div>
					),
				)}

				<div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
				<div className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/70" />

				<div
					ref={labelElRef}
					className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 shadow-sm backdrop-blur"
				>
					{formatSide(labelW)} × {formatSide(labelH)}
				</div>
			</div>
		</div>
	)
}
