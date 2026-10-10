'use client'

import { useT, usePreferences } from '@/lib/preferences'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import type { HeroPhase, HeroSceneHandle } from '@/lib/heroTerrainScene'

const CONFIG = '/create?form=mountain&m=silver&sf=polished&d=high&h=3.77&sz=17&r=2179&w=classic&bp=classic&sh=classic&b=-90&lat=44.09865&lng=43.02519&p=%D0%91%D0%B5%D1%88%D1%82%D0%B0%D1%83&s=relief'
type Phase = HeroPhase | 'loading' | 'error'

export function HeroTerrain() {
	const t = useT()
	const theme = usePreferences(s => s.theme)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const frameRef = useRef<HTMLDivElement>(null)
	const sceneRef = useRef<HeroSceneHandle | null>(null)
	const [phase, setPhase] = useState<Phase>('loading')
	const [attempt, setAttempt] = useState(0)
	const descriptionId = useId()

	useEffect(() => {
		const canvas = canvasRef.current, frame = frameRef.current
		if (!canvas || !frame) return
		const abort = new AbortController()
		let cancelled = false, inView = false, scene: HeroSceneHandle | null = null
		const reduced = matchMedia('(prefers-reduced-motion: reduce)')
		const syncVisibility = () => scene?.setVisible(inView && document.visibilityState === 'visible')
		const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncVisibility() }, { threshold: .08 })
		observer.observe(frame)
		document.addEventListener('visibilitychange', syncVisibility)
		setPhase('loading')
		import('@/lib/heroTerrainScene').then(module => module.createHeroTerrainScene(canvas, {
			theme: usePreferences.getState().theme,
			signal: abort.signal,
			reducedMotion: reduced.matches,
			onPhase: value => { if (!cancelled) setPhase(value) },
			onError: () => { if (!cancelled) setPhase('error') },
		})).then(handle => {
			if (cancelled) { handle.dispose(); return }
			scene = handle; sceneRef.current = handle; handle.setTheme(usePreferences.getState().theme); syncVisibility()
		}).catch(error => {
			if (!cancelled && error?.name !== 'AbortError') setPhase('error')
		})
		const preferenceChanged = () => { if (reduced.matches) scene?.finish() }
		reduced.addEventListener('change', preferenceChanged)
		return () => {
			cancelled = true; abort.abort(); scene?.dispose(); sceneRef.current = null
			observer.disconnect(); document.removeEventListener('visibilitychange', syncVisibility)
			reduced.removeEventListener('change', preferenceChanged)
		}
	}, [attempt])
	useEffect(() => { sceneRef.current?.setTheme(theme) }, [theme])

	const ready = phase !== 'loading' && phase !== 'error'
	return (
		<figure className="m-0 overflow-hidden rounded-2xl border border-zinc-200 bg-[#f4f3f0]" data-testid="hero-terrain" data-phase={phase}>
			<div ref={frameRef} className="relative aspect-[1.14] w-full min-h-[280px] overflow-hidden sm:aspect-[1.22]">
				<div className="pointer-events-none absolute left-5 top-5 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-zinc-500">
					<span className="h-1 w-1 rounded-full bg-zinc-400" />44.09865° N · 43.02519° E
				</div>
				{/* A real render remains visible while the WebGL scene loads or if WebGL is unavailable. */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/hero/beshtau/poster.webp" alt={t("Серебряное кольцо с рельефом Бештау")} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${ready ? 'opacity-0' : 'opacity-100'}`} />
				<canvas key={attempt} ref={canvasRef} tabIndex={phase === 'ring' ? 0 : -1} aria-label={t("Трёхмерная модель кольца Бештау. Вращайте мышью, пальцем или клавишами со стрелками.")} aria-describedby={descriptionId} className={`absolute inset-0 h-full w-full outline-none transition-opacity duration-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600 ${ready ? 'opacity-100' : 'opacity-0'} ${phase === 'ring' ? 'cursor-grab active:cursor-grabbing' : ''}`} />
				<div className="absolute bottom-5 left-5 right-5 z-10 flex items-center justify-between gap-3">
					<p id={descriptionId} className="text-[11px] text-zinc-600" aria-live="polite">
						{phase === 'loading' ? t('Загружаем ваш ландшафт…') : phase === 'mountain' ? t('Всё начинается с места.') : phase === 'transition' ? t('Ваш ландшафт становится металлом.') : phase === 'ring' ? t('Потяните, чтобы повернуть кольцо') : t('Рельеф Бештау — в серебре')}
					</p>
					{phase === 'ring' ? <button type="button" onClick={() => sceneRef.current?.replay()} className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-400/40 bg-[#f4f3f0]/85 px-3 text-[11px] text-zinc-600 backdrop-blur-sm transition hover:border-zinc-500 hover:text-zinc-900"><span aria-hidden="true">↻</span>{t("Повторить")}</button>
						: phase === 'error' ? <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-10 shrink-0 px-3 text-[11px] text-zinc-600 underline underline-offset-4">{t("Загрузить 3D")}</button>
							: ready ? <button type="button" onClick={() => sceneRef.current?.finish()} className="min-h-10 shrink-0 px-2 text-[11px] text-zinc-500 transition hover:text-zinc-900">{t("Смотреть кольцо →")}</button> : null}
				</div>
			</div>
			<figcaption className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-5 py-5">
				<div><p className="font-display text-2xl font-semibold">{t("Бештау")}</p><p className="mt-1 text-[11px] text-zinc-500">{t("Серебро · полировка · ваш рельеф")}</p></div>
				<Link href={CONFIG} className="inline-flex min-h-11 items-center gap-3 text-xs text-zinc-600 transition hover:text-zinc-900">{t("Открыть в мастерской")}<span aria-hidden="true">↗</span></Link>
			</figcaption>
		</figure>
	)
}
