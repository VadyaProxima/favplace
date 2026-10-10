'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MATERIALS, calcPrice, formatPrice } from '@favplace/shared'
import { STEPS, useAppStore } from '@/store/useAppStore'
import { FormRingViewer } from './FormRingViewer'
import { StepProgress } from './StepProgress'
import { StlExportButton } from './StlExportButton'
import { STUDIO_SECTIONS, STUDIO_STEP_TITLES } from './studioSections'
import styles from './CreateStudio.module.css'

const fmtSize = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '')

export function StudioLayout({ children, isAdmin, fetching, shared, onShare }: {
	children: ReactNode
	isAdmin: boolean
	fetching: boolean
	shared: boolean
	onShare: () => void
}) {
	const step = useAppStore(s => s.step)
	const setStep = useAppStore(s => s.setStep)
	const ringForm = useAppStore(s => s.ringForm)
	const material = useAppStore(s => s.material)
	const reliefDetail = useAppStore(s => s.reliefDetail)
	const twoTone = useAppStore(s => s.mountainTwoTone)
	const ringSize = useAppStore(s => s.ringSize)
	const location = useAppStore(s => s.location)
	const [previewOverride, setPreviewOverride] = useState<boolean | null>(null)
	const [shortScreen, setShortScreen] = useState(false)
	const contentRef = useRef<HTMLDivElement>(null)
	const stepIndex = STEPS.indexOf(step)
	const sectionIndex = STUDIO_SECTIONS.findIndex(section => section.steps.includes(step))
	const section = STUDIO_SECTIONS[sectionIndex]
	const isLast = step === 'order'
	const previewExpanded = previewOverride ?? (!shortScreen && !isLast)
	const price = calcPrice({ ringForm, material, reliefDetail, twoTone })
	const next = STEPS[stepIndex + 1]

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

	return (
		<div className={styles.studio}>
			<header className={styles.header}>
				<Link href="/" className="font-display text-2xl font-semibold tracking-tight">Favplace<span className="sr-only"> — на главную</span></Link>
				<span className={styles.headerTitle}>Создать своё кольцо</span>
				<div className={styles.headerActions}>
					{isAdmin && <StlExportButton />}
					<button type="button" onClick={() => setPreviewOverride(!previewExpanded)} aria-expanded={previewExpanded} aria-controls="ring-preview" className={styles.previewToggle}>
						<span className="sr-only">{previewExpanded ? 'Скрыть' : 'Показать'} </span>3D {previewExpanded ? '↑' : '↓'}
					</button>
					<button type="button" onClick={onShare} className={styles.share} aria-live="polite" aria-label={shared ? 'Ссылка скопирована' : 'Поделиться'}>
						<span aria-hidden="true">{shared ? '✓' : '↗'}</span><span className={styles.shareLabel}>{shared ? 'Скопировано' : 'Поделиться'}</span>
					</button>
				</div>
			</header>

			<div className={styles.navigation}><StepProgress /></div>

			<main className={styles.workspace}>
				<section className={styles.result} aria-label="Предпросмотр и параметры кольца">
					<div className={styles.resultHeading}>
						<div><p className={styles.eyebrow}>Ваше изделие</p><h1 className="font-display text-2xl font-semibold">Горное кольцо</h1></div>
						<span className={styles.modelHint}>Вращайте, чтобы рассмотреть</span>
					</div>
					<section id="ring-preview" aria-label="3D-превью кольца" className={styles.preview} data-expanded={previewExpanded} data-preview-mode={previewOverride === null ? 'auto' : 'manual'}>
						<FormRingViewer className="h-full w-full" />
						{fetching && <div role="status" className={styles.loading}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900" />Уточняем высоты</div>}
						<p className={styles.previewHint}>Вращайте кольцо пальцем · приближайте двумя</p>
					</section>
					<dl className={styles.summary}>
						<div className={styles.summaryPlace}><dt>Место</dt><dd>{location?.name ?? 'Выберите точку на карте'}{location && <p>{location.coordinates.lat.toFixed(4)}° · {location.coordinates.lng.toFixed(4)}°</p>}</dd></div>
						<div><dt>Металл</dt><dd>{MATERIALS[material].label}</dd></div>
						<div><dt>Размер</dt><dd>⌀ {fmtSize(ringSize)} мм</dd></div>
					</dl>
				</section>

				<section aria-label="Настройки кольца" className={styles.panel}>
					<div className={styles.panelHeading}>
						<p className={styles.eyebrow}>0{sectionIndex + 1} / {section.title}</p>
						{section.steps.length > 1 && <nav aria-label="Параметры раздела" className={styles.subNavigation}>
							{section.steps.map(id => <button key={id} type="button" onClick={() => setStep(id)} aria-current={id === step ? 'step' : undefined}>{STUDIO_STEP_TITLES[id]}</button>)}
						</nav>}
					</div>
					<div ref={contentRef} className={styles.content}>{children}</div>
				</section>
			</main>

			<footer className={styles.footer}>
				<div className={styles.footerInner}>
					<div className={styles.price}><span>Стоимость кольца</span><strong className="font-display">{formatPrice(price.total)}</strong></div>
					<div className={styles.footerControls}>
						{stepIndex > 0 && <button type="button" onClick={() => setStep(STEPS[stepIndex - 1])} aria-label="Предыдущий шаг" className={styles.back}><span aria-hidden="true">←</span><span className={styles.backLabel}>Назад</span></button>}
						{!isLast && <button type="button" onClick={() => setStep(next)} className={styles.next}>{next === 'order' ? 'Проверить и оформить' : STUDIO_STEP_TITLES[next]} <span aria-hidden="true">→</span></button>}
						{isLast && <span className={styles.orderHint}>Без оплаты сейчас</span>}
					</div>
				</div>
			</footer>
		</div>
	)
}
