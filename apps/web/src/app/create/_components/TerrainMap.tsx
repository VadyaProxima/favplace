'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'

export interface FlyTarget {
	lng: number
	lat: number
	/** bump to force a fly even if coords are equal */
	key: number
}

interface TerrainMapProps {
	/** external "go here" command (search result pick) */
	target: FlyTarget
	/** selection half-side in meters (the analysis radius) */
	radius: number
	onCenterChange: (lng: number, lat: number) => void
	onRadiusChange: (radius: number) => void
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
 * the map moves underneath — whatever sits under the frame is what gets
 * analyzed. The selection center is therefore always the map center, and it
 * is re-emitted on every pan/zoom end, so the store can never go stale
 * (the old geo-anchored frame could drift off-screen after a pan, leaving
 * "Анализировать" pointed at an invisible old spot).
 *
 * The frame's pixel size is still geo-true: it equals the analysis square
 * projected at the current zoom, so zooming out shrinks the frame with the
 * terrain. Corner handles resize the analysis area; presets refit the zoom.
 */
export function TerrainMap({ target, radius, onCenterChange, onRadiusChange }: TerrainMapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<maplibregl.Map | null>(null)
	const frameElRef = useRef<HTMLDivElement>(null)
	const labelElRef = useRef<HTMLDivElement>(null)

	const onCenterChangeRef = useRef(onCenterChange)
	onCenterChangeRef.current = onCenterChange
	const onRadiusChangeRef = useRef(onRadiusChange)
	onRadiusChangeRef.current = onRadiusChange

	const [styleType, setStyleType] = useState<MapStyleType>('satellite')
	const [mapReady, setMapReady] = useState(false)

	const radiusRef = useRef(radius)
	const lastEmittedRadiusRef = useRef(radius)
	const rafRef = useRef<number | null>(null)
	const resizeDragRef = useRef<{ pointerId: number } | null>(null)

	/** px on screen for 1000 m of latitude at the current map center */
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
		const size = ((radiusRef.current * 2) / 1000) * pxPer1000m()
		el.style.width = `${size}px`
		el.style.height = `${size}px`
		if (labelElRef.current) {
			const side = formatSide(radiusRef.current * 2)
			labelElRef.current.textContent = `${side} × ${side}`
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

	/** set zoom so the frame occupies ~FIT_FRACTION of the shorter side */
	const fitZoomToFrame = (center?: [number, number], jump = false) => {
		const map = mapRef.current
		const container = containerRef.current
		if (!map || !container) return
		const rect = container.getBoundingClientRect()
		const desiredPx = FIT_FRACTION * Math.min(rect.width, rect.height)
		const currentPx = ((radiusRef.current * 2) / 1000) * pxPer1000m()
		if (currentPx <= 0) return
		const zoom = Math.min(
			STYLE_TILES[styleType].maxzoom,
			Math.max(2, map.getZoom() + Math.log2(desiredPx / currentPx)),
		)
		const opts = { center: center ?? map.getCenter(), zoom }
		if (jump) map.jumpTo(opts)
		else map.easeTo({ ...opts, duration: 350 })
	}

	// ── init map once ──────────────────────────────────────────────────────
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

		// zoom changes the meters-per-pixel scale → keep the frame geo-true
		map.on('move', scheduleFrameSize)
		// any settled movement (pan, zoom, fly) → selection = what's under the frame
		map.on('moveend', emitCenter)

		map.on('load', () => {
			map.resize()
			fitZoomToFrame([target.lng, target.lat], true)
			applyFrameSize()
			setMapReady(true)
			emitCenter()
		})

		// click recenters the frame on the clicked spot (moveend emits coords)
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

	// ── corner-handle resize (window-level so the moving handle can't
	//    re-trigger its own pointermove and loop) ───────────────────────────
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
			const halfPx = Math.max(Math.abs(px - cx), Math.abs(py - cy))
			radiusRef.current = Math.min(
				MAX_RADIUS,
				Math.max(MIN_RADIUS, (halfPx / pxPer1000m()) * 1000),
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

	// ── basemap switch ─────────────────────────────────────────────────────
	useEffect(() => {
		mapRef.current?.setStyle(buildStyle(styleType), { diff: false })
	}, [styleType])

	// ── external fly (search pick) ─────────────────────────────────────────
	const lastTargetKeyRef = useRef(target.key)
	useEffect(() => {
		if (target.key === lastTargetKeyRef.current) return
		lastTargetKeyRef.current = target.key
		fitZoomToFrame([target.lng, target.lat])
		scheduleFrameSize()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [target.key])

	// ── radius from outside (preset buttons) ───────────────────────────────
	useEffect(() => {
		radiusRef.current = radius
		if (radius !== lastEmittedRadiusRef.current) {
			lastEmittedRadiusRef.current = radius
			fitZoomToFrame()
		}
		scheduleFrameSize()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [radius])

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

			{/* fixed-center frame; body is click-through so the map pans under it */}
			<div
				ref={frameElRef}
				className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none ${mapReady ? '' : 'invisible'}`}
			>
				<div className="absolute inset-0 border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />

				{(['left-0 top-0', 'right-0 top-0', 'left-0 bottom-0', 'right-0 bottom-0'] as const).map(pos => (
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
				))}

				<div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
				<div className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/70" />

				<div
					ref={labelElRef}
					className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 shadow-sm backdrop-blur"
				>
					{formatSide(radius * 2)} × {formatSide(radius * 2)}
				</div>
			</div>
		</div>
	)
}
