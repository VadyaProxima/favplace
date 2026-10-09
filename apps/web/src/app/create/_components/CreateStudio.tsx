'use client'

import { useAdminSession } from '@/lib/adminSession'
import {
	createTerrainRequestPlan,
	terrainFrameFromResponse,
	terrainRequestUrl,
	waitForTerrainStageDelay,
	type TerrainApiResponse,
} from '@/lib/referenceTerrainRequests'
import { STEPS, STEP_LABELS, useAppStore } from '@/store/useAppStore'
import { MATERIALS, calcPrice, formatPrice } from '@favplace/shared'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FormRingViewer, RING_FORM_OPTIONS } from './FormRingViewer'
import { StepProgress } from './StepProgress'
import { StlExportButton } from './StlExportButton'
import type { FlyTarget } from './TerrainMap'
import { StepForm } from './steps/StepForm'
import { StepMaterial } from './steps/StepMaterial'
import { StepOrder } from './steps/StepOrder'
import { StepPlace } from './steps/StepPlace'
import { StepRelief } from './steps/StepRelief'
import { StepSize } from './steps/StepSize'
import { buildShareUrl, useConfigUrl } from './useConfigUrl'
import styles from './CreateStudio.module.css'

const fmtSize = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '')

export function CreateStudio() {
	// Экспорт STL — служебная операция, покупателю она не нужна.
	// Вход: /admin. Гейт косметический: сама сборка файла живёт в браузере.
	const { isAdmin } = useAdminSession()

	const step = useAppStore(s => s.step)
	const setStep = useAppStore(s => s.setStep)
	const nextStep = useAppStore(s => s.nextStep)
	const prevStep = useAppStore(s => s.prevStep)

	const ringForm = useAppStore(s => s.ringForm)
	const material = useAppStore(s => s.material)
	const reliefDetail = useAppStore(s => s.reliefDetail)
	const engraving = useAppStore(s => s.engraving)
	const twoTone = useAppStore(s => s.mountainTwoTone)
	const ringSize = useAppStore(s => s.ringSize)

	const setReferenceTerrainFrames = useAppStore(s => s.setReferenceTerrainFrames)
	const setEdgeTerrainFrames = useAppStore(s => s.setEdgeTerrainFrames)

	const [fetching, setFetching] = useState(false)
	const [shared, setShared] = useState(false)
	const [previewOverride, setPreviewOverride] = useState<boolean | null>(null)
	const [shortScreen, setShortScreen] = useState(false)
	const contentRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const query = window.matchMedia('(max-height: 480px)')
		const update = () => setShortScreen(query.matches)
		update()
		query.addEventListener('change', update)
		return () => query.removeEventListener('change', update)
	}, [])

	useEffect(() => {
		setPreviewOverride(null)
		contentRef.current?.scrollTo({ top: 0 })
	}, [step])

	const previewExpanded = previewOverride ?? (!shortScreen && step !== 'place' && step !== 'order')
	const [flyTarget, setFlyTarget] = useState<FlyTarget>({
		lng: 138.7307,
		lat: 35.3628,
		key: 0,
	})

	const analyzeSeqRef = useRef(0)
	const analyzeAbortRef = useRef<AbortController | null>(null)

	/**
	 * Рельеф приходит лесенкой: сперва грубый кадр и широкий контекст для
	 * плеч, затем всё более точные кропы. Первый кадр появляется сразу,
	 * последний — точный — только если жест уже закончился.
	 */
	const analyze = useCallback(
		async (lat: number, lng: number, r: number, bearing: number) => {
			const seq = ++analyzeSeqRef.current
			analyzeAbortRef.current?.abort()
			const ac = new AbortController()
			analyzeAbortRef.current = ac
			setFetching(true)
			try {
				const plan = createTerrainRequestPlan({
					lat,
					lng,
					radiusMeters: r,
					bearing,
				})
				const requestStage = async (stage: (typeof plan.fine)[number]) => {
					await waitForTerrainStageDelay(stage.delayMs, ac.signal)
					const res = await fetch(terrainRequestUrl(stage), { signal: ac.signal })
					if (!res.ok) throw new Error(`Terrain API ${res.status}`)
					return (await res.json()) as TerrainApiResponse
				}

				const [coarseData, firstFineData] = await Promise.all([
					requestStage(plan.coarse),
					requestStage(plan.fine[0]),
				])
				if (seq !== analyzeSeqRef.current) return
				const coarse = terrainFrameFromResponse(coarseData, true)
				let fine = terrainFrameFromResponse(firstFineData, false)
				setReferenceTerrainFrames(fine, coarse, fine.frame)

				for (const stage of plan.fine.slice(1)) {
					const nextData = await requestStage(stage)
					if (seq !== analyzeSeqRef.current) return
					fine = terrainFrameFromResponse(nextData, stage.final)
					setReferenceTerrainFrames(fine, coarse, fine.frame)
				}
			} catch (err) {
				if ((err as Error)?.name === 'AbortError') return
			} finally {
				if (seq === analyzeSeqRef.current) setFetching(false)
			}
		},
		[setReferenceTerrainFrames],
	)

	// Вторая местность формы «duo». Отдельный лёгкий запрос: она ложится
	// узкими полосами по краям площадки, и разрешение 512 там избыточно.
	const edgeLat = useAppStore(s => s.edgeLocation?.coordinates.lat)
	const edgeLng = useAppStore(s => s.edgeLocation?.coordinates.lng)
	const edgeRadius = useAppStore(s => s.edgeRadius)
	const ringFormForEdge = useAppStore(s => s.ringForm)
	useEffect(() => {
		if (ringFormForEdge !== 'duo') return
		if (edgeLat === undefined || edgeLng === undefined) return
		const ac = new AbortController()
		const timer = setTimeout(async () => {
			try {
				const plan = createTerrainRequestPlan({
					lat: edgeLat,
					lng: edgeLng,
					radiusMeters: edgeRadius,
					bearing: 0,
				})
				const stage = plan.fine[plan.fine.length - 1]
				const res = await fetch(terrainRequestUrl(stage), { signal: ac.signal })
				if (!res.ok) throw new Error(`Terrain API ${res.status}`)
				const data = (await res.json()) as TerrainApiResponse
				setEdgeTerrainFrames(terrainFrameFromResponse(data, true), null)
			} catch {
				// Вторая местность необязательна: если кадр не пришёл, кольцо
				// строится по основной местности, а не падает.
			}
		}, 120)
		return () => {
			clearTimeout(timer)
			ac.abort()
		}
	}, [ringFormForEdge, edgeLat, edgeLng, edgeRadius, setEdgeTerrainFrames])

	const flyTo = useCallback((lat: number, lng: number) => {
		setFlyTarget(prev => ({ lat, lng, key: prev.key + 1 }))
	}, [])

	// Рельеф пересчитывается прямо во время движения карты: TerrainMap шлёт
	// координаты примерно 5 раз в секунду, здесь остаётся короткий зазор,
	// чтобы склеить соседние кадры. Незавершённый запрос analyze отменяет сам.
	const lat = useAppStore(s => s.location?.coordinates.lat)
	const lng = useAppStore(s => s.location?.coordinates.lng)
	const radius = useAppStore(s => s.radius)
	const terrainBearing = useAppStore(s => s.terrainBearing)

	useEffect(() => {
		if (lat === undefined || lng === undefined) return
		const timer = setTimeout(() => analyze(lat, lng, radius, terrainBearing), 60)
		return () => clearTimeout(timer)
	}, [lat, lng, radius, terrainBearing, analyze])

	// Ссылка-конфигурация: подхватываем место. Рельеф построит эффект выше.
	const onHydrated = useCallback(
		(hLat: number, hLng: number) => flyTo(hLat, hLng),
		[flyTo],
	)
	useConfigUrl(onHydrated)

	const share = async () => {
		const url = buildShareUrl()
		try {
			await navigator.clipboard.writeText(url)
			setShared(true)
			setTimeout(() => setShared(false), 2000)
		} catch {
			window.prompt('Скопируйте ссылку на конфигурацию:', url)
		}
	}

	const stepIndex = STEPS.indexOf(step)
	const isLast = stepIndex === STEPS.length - 1
	const formLabel = RING_FORM_OPTIONS.find(o => o.id === ringForm)?.label ?? ringForm
	const price = calcPrice({
		ringForm,
		material,
		reliefDetail,
		engraving,
		twoTone,
	})

	return (
		<div className={styles.studio}>
			<header className={`${styles.header} flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2 lg:px-8 lg:py-4`}>
				<Link href="/" className="font-display text-xl font-semibold tracking-tight">
					Favplace
				</Link>
				<span className="hidden text-[11px] uppercase tracking-wider text-zinc-400 lg:block">
					Конструктор
				</span>
				{isAdmin && (
					<div className="relative z-30 ml-auto lg:hidden"><StlExportButton /></div>
				)}
				<button
					type="button"
					onClick={share}
					className="min-h-11 min-w-11 px-2 text-xs font-medium text-zinc-700 lg:hidden"
					aria-live="polite"
					aria-label={shared ? 'Ссылка скопирована' : 'Поделиться'}
				>
					{isAdmin ? (shared ? '✓' : '↗') : (shared ? 'Ссылка скопирована' : 'Поделиться ↗')}
				</button>
			</header>
			<section
				aria-label="3D-превью кольца"
				className={styles.preview}
				data-expanded={previewExpanded}
				data-preview-mode={previewOverride === null ? 'auto' : 'manual'}
				id="ring-preview"
			>
				<div className="absolute inset-0">
					<FormRingViewer className="h-full w-full" />
				</div>

				{fetching && (
					<div role="status" className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-2 bg-white/90 px-3 py-1.5 text-xs text-zinc-600 backdrop-blur lg:left-6 lg:top-6">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900" />
						Рельеф…
					</div>
				)}

				<p className="pointer-events-none absolute bottom-3 inset-x-4 text-center text-[11px] text-zinc-500 lg:hidden">
					Вращайте кольцо пальцем · приближайте двумя
				</p>

				<div className="pointer-events-none absolute bottom-6 left-6 z-10 hidden lg:block">
					<p className="text-[11px] uppercase tracking-wider text-zinc-500">
						{formLabel} · ⌀ {fmtSize(ringSize)} мм · {MATERIALS[material].label}
					</p>
					<p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-zinc-800">
						{formatPrice(price.total)}
					</p>
				</div>

				<div className="absolute bottom-6 right-6 z-10 hidden items-center gap-2 lg:flex">
					{isAdmin && <StlExportButton />}
					<button
						type="button"
						onClick={share}
						className="hidden border border-zinc-300 bg-white/80 px-3.5 py-2 text-xs font-medium text-zinc-700 backdrop-blur transition hover:bg-white lg:block"
					>
						{shared ? 'Ссылка скопирована' : 'Поделиться'}
					</button>
				</div>
			</section>

			<aside aria-label="Настройки кольца" className={styles.panel}>
				<div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-1 lg:px-8 lg:py-2">
					<button
						type="button"
						onClick={prevStep}
						disabled={stepIndex === 0}
						aria-label="Предыдущий шаг"
						className="flex size-11 shrink-0 items-center justify-center text-lg text-zinc-500 transition hover:text-zinc-800 disabled:opacity-0"
					>
						←
					</button>
					<span className="min-w-0 flex-1 lg:text-center">
						<span className="font-display text-lg font-medium text-zinc-900">
							{STEP_LABELS[step]}
						</span>
						<span className="ml-2 text-xs tabular-nums text-zinc-400">
							{stepIndex + 1}/{STEPS.length}
						</span>
					</span>
					<button
						type="button"
						onClick={() => setPreviewOverride(!previewExpanded)}
						aria-expanded={previewExpanded}
						aria-controls="ring-preview"
						className="min-h-11 shrink-0 px-2 text-xs font-medium text-zinc-600 lg:hidden"
					>
						{previewExpanded ? 'Скрыть 3D ↑' : 'Показать 3D ↓'}
					</button>
					<button
						type="button"
						onClick={nextStep}
						disabled={isLast}
						aria-label="Следующий шаг"
						className="hidden size-11 shrink-0 items-center justify-center text-lg text-zinc-500 transition hover:text-zinc-800 disabled:opacity-0 lg:flex"
					>
						→
					</button>
				</div>

				<div className="shrink-0 border-b border-zinc-100 px-4 lg:hidden"><StepProgress /></div>

				<div ref={contentRef} className={`${styles.content} px-4 py-5 lg:px-8 lg:py-6`}>
					{step === 'form' && <StepForm />}
					{step === 'place' && (
						<StepPlace flyTarget={flyTarget} flyTo={flyTo} fetching={fetching} />
					)}
					{step === 'relief' && <StepRelief />}
					{step === 'material' && <StepMaterial />}
					{step === 'size' && <StepSize />}
					{step === 'order' && <StepOrder />}
				</div>

				<div className={`${styles.footer} flex shrink-0 items-center gap-4 border-t border-zinc-200 bg-white px-4 pt-3 lg:px-8 lg:py-4`}>
					<div className="hidden min-w-0 flex-1 lg:block"><StepProgress /></div>
					<div className="min-w-0 flex-1 lg:hidden">
						<p className="truncate text-[11px] text-zinc-500">{MATERIALS[material].label} · ⌀ {fmtSize(ringSize)} мм</p>
						<p className="font-display text-2xl font-semibold tabular-nums text-zinc-900">{formatPrice(price.total)}</p>
					</div>
					{!isLast && (
						<button
							type="button"
							onClick={() => setStep(STEPS[stepIndex + 1])}
							className="min-h-12 shrink-0 rounded-full bg-zinc-900 px-7 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 lg:text-xs lg:uppercase lg:tracking-wider"
						>
							{stepIndex === STEPS.length - 2 ? 'К заказу →' : 'Далее →'}
						</button>
					)}
					{isLast && <span className="text-xs text-zinc-400 lg:hidden">Без оплаты сейчас</span>}
				</div>
			</aside>
		</div>
	)
}
