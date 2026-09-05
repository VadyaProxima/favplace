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
	/** поворот выбранного кропа по часовой, градусы */
	bearing?: number
	/** карта движется — кольцо строится по черновой сетке */
	onInteractingChange?: (interacting: boolean) => void
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
	bearing = 0,
	onInteractingChange,
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
	const onInteractingChangeRef = useRef(onInteractingChange)
	onInteractingChangeRef.current = onInteractingChange

	const [styleType, setStyleType] = useState<MapStyleType>('satellite')
	const [mapReady, setMapReady] = useState(false)

	const radiusRef = useRef(radius)
	const lastEmittedRadiusRef = useRef(radius)
	const rafRef = useRef<number | null>(null)
	const initialFitDoneRef = useRef(false)
	const lastLiveEmitRef = useRef(0)

	const pxPer1000m = () => {
		const map = mapRef.current
		if (!map) return 1
		const c = map.getCenter()
		const p1 = map.project([c.lng, c.lat])
		const p2 = map.project([c.lng, c.lat + 1000 / 111_320])
		return Math.abs(p1.y - p2.y) || 1
	}

	/**
	 * Рамка занимает постоянную долю окна и в пикселях не меняется.
	 * Площадь съёмки регулируется зумом карты — рамка её только показывает.
	 */
	const frameLongPx = () => {
		const rect = containerRef.current?.getBoundingClientRect()
		if (!rect || rect.width === 0) return 0
		return FIT_FRACTION * Math.min(rect.width, rect.height * frameAspect(frameShapeRef.current))
	}

	/** Сколько метров сейчас попадает в рамку по длинной стороне. */
	const frameSideMeters = () => (frameLongPx() / pxPer1000m()) * 1000

	/** Половина длинной стороны — тот самый radius, которым живёт весь конструктор. */
	const currentRadius = () =>
		Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(frameSideMeters() / 2)))

	const applyFrameSize = () => {
		const el = frameElRef.current
		if (!el) return
		const shape = frameShapeRef.current
		const aspect = frameAspect(shape)
		const longPx = frameLongPx()
		el.style.width = `${longPx}px`
		el.style.height = `${longPx / aspect}px`
		if (borderElRef.current) {
			borderElRef.current.style.borderRadius = frameRadiusCss(shape)
		}
		if (labelElRef.current) {
			const wM = frameSideMeters()
			labelElRef.current.textContent = `${formatSide(wM)} × ${formatSide(wM / aspect)}`
		}
	}

	// Таймер, а не requestAnimationFrame: в фоновой вкладке rAF не вызывается
	// вообще, и рамка оставалась бы неинициализированной вместе с подписью.
	const scheduleFrameSize = () => {
		if (rafRef.current !== null) return
		rafRef.current = window.setTimeout(() => {
			rafRef.current = null
			applyFrameSize()
		}, 16)
	}

	/**
	 * Отдаём наружу и центр, и площадь — оба меняются одним жестом.
	 * Только по moveend: во время панорамирования писать в стор незачем,
	 * иначе рельеф пересчитывался бы на каждый кадр.
	 */
	const emitViewport = () => {
		const map = mapRef.current
		if (!map) return
		const c = map.getCenter()
		onCenterChangeRef.current(c.lng, c.lat)

		// До первой подгонки зум ещё стартовый, и вычисленная из него площадь
		// затёрла бы radius, пришедший из ссылки.
		if (!initialFitDoneRef.current) return

		const r = currentRadius()
		// Допуск: после подгонки зума под пресет обратный пересчёт даёт
		// 1999 вместо 2000. Без него пресет сразу терял бы подсветку.
		const drift = Math.abs(r - lastEmittedRadiusRef.current) / lastEmittedRadiusRef.current
		if (drift > 0.015) {
			lastEmittedRadiusRef.current = r
			radiusRef.current = r
			onRadiusChangeRef.current(r)
		}
	}

	/**
	 * Первая подгонка зума под radius из ссылки. На событии `load` контейнер
	 * бывает ещё нулевого размера — тогда подгонка молча пропускалась, и
	 * первый же emitViewport фиксировал площадь по стартовому зуму.
	 * Поэтому пробуем повторно, пока размер не появится.
	 */
	const tryInitialFit = (center?: [number, number]) => {
		if (initialFitDoneRef.current) return
		if (!mapRef.current || frameLongPx() <= 0) return
		initialFitDoneRef.current = true
		fitZoomToFrame(center, true)
		applyFrameSize()
		emitViewport()
	}

	/** Подбирает зум так, чтобы в рамку постоянного размера попало radius×2 метров. */
	const fitZoomToFrame = (center?: [number, number], jump = false) => {
		const map = mapRef.current
		if (!map) return
		const longPx = frameLongPx()
		if (longPx <= 0) return
		const neededPxPer1000m = longPx / ((radiusRef.current * 2) / 1000)
		const zoom = Math.min(
			STYLE_TILES[styleType].maxzoom,
			Math.max(2, map.getZoom() + Math.log2(neededPxPer1000m / pxPer1000m())),
		)
		const opts = { center: center ?? map.getCenter(), zoom }
		if (jump) map.jumpTo(opts)
		else map.easeTo({ ...opts, duration: 350 })
	}

	useEffect(() => {
		if (!containerRef.current || mapRef.current) return
		// Ref переживает размонтирование, карта — нет. Без сброса второй
		// монтаж в StrictMode считал бы подгонку зума уже выполненной.
		initialFitDoneRef.current = false
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

		// Рельеф должен обновляться прямо во время перетаскивания, но писать в
		// стор на каждый кадр нельзя — throttle держит поток на ~5 обновлений
		// в секунду. Перестроение меша занимает ~55 мс, в этот бюджет влезает.
		map.on('movestart', () => onInteractingChangeRef.current?.(true))
		map.on('move', () => {
			scheduleFrameSize()
			const now = performance.now()
			if (now - lastLiveEmitRef.current < 300) return
			lastLiveEmitRef.current = now
			onInteractingChangeRef.current?.(true)
			emitViewport()
		})
		// На остановке — точное финальное значение без throttle,
		// и переход на точную сетку рельефа
		map.on('moveend', () => {
			lastLiveEmitRef.current = 0
			emitViewport()
			onInteractingChangeRef.current?.(false)
		})

		// Ни на 'load', ни на ResizeObserver полагаться нельзя: оба начинались
		// с map.resize(), и одна его осечка глушила всю инициализацию рамки.
		// Поэтому опрашиваем кадрами, пока контейнер не получит размер.
		let initFrame = 0
		let attempts = 0
		const pump = () => {
			attempts++
			try {
				map.resize()
			} catch {
				/* стиль ещё не готов — не повод бросать инициализацию */
			}
			applyFrameSize()
			tryInitialFit([target.lng, target.lat])
			if (initialFitDoneRef.current) {
				setMapReady(true)
				return
			}
			if (attempts < 120) initFrame = window.setTimeout(pump, 25)
		}
		pump()

		map.on('click', e => {
			map.easeTo({ center: e.lngLat, duration: 300 })
		})

		const ro = new ResizeObserver(() => {
			try {
				map.resize()
			} catch {
				/* см. pump выше */
			}
			scheduleFrameSize()
			// Рамка привязана к размеру окна, значит площадь съёмки изменилась
			emitViewport()
		})
		ro.observe(containerRef.current)

		return () => {
			clearTimeout(initFrame)
			ro.disconnect()
			if (rafRef.current !== null) clearTimeout(rafRef.current)
			try {
				map.remove()
			} catch {}
			mapRef.current = null
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
		// Другая пропорция рамки — другая площадь в кадре
		emitViewport()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [frameShape])

	// Рамку крутим, подпись — обратно, чтобы она осталась читаемой.
	useEffect(() => {
		if (frameElRef.current) frameElRef.current.style.rotate = `${bearing}deg`
		if (labelElRef.current) labelElRef.current.style.rotate = `${-bearing}deg`
	}, [bearing])

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
				style={{ rotate: `${bearing}deg` }}
			>
				<div
					ref={borderElRef}
					className="absolute inset-0 border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
					style={{ borderRadius: frameRadiusCss(frameShape) }}
				/>

				<div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
				<div className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/70" />

				{/*
					Содержимое пишет applyFrameSize напрямую в textContent.
					Детей здесь быть не должно: React затирал бы вычисленную
					площадь обратно на radius × 2 при каждом ререндере.
				*/}
				<div
					ref={labelElRef}
					className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 shadow-sm backdrop-blur"
					style={{ rotate: `${-bearing}deg` }}
				/>
			</div>
		</div>
	)
}
