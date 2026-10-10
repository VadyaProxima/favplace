'use client'

import { useT, usePriceFormatter, useNumberFormatter } from '@/lib/preferences'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { HeaderPreferences } from '../../_ui/HeaderPreferences'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { RING_PRODUCTION_DEFAULTS, calcPrice } from '@favplace/shared'
import { STEPS, useAppStore } from '@/store/useAppStore'
import { FormRingViewer } from './FormRingViewer'
import { CanvasMouseHint } from './CanvasMouseHint'
import { ResizableWorkspace } from './ResizableWorkspace'
import { StepProgress } from './StepProgress'
import { StlExportButton } from './StlExportButton'
import { STUDIO_SECTIONS, STUDIO_STEP_TITLES } from './studioSections'
import styles from './CreateStudio.module.css'

export function StudioLayout({ children, isAdmin, fetching, shared, onShare }: {
	children: ReactNode
	isAdmin: boolean
	fetching: boolean
	shared: boolean
	onShare: () => void
}) {
	const t = useT()
	const formatPrice = usePriceFormatter()
	const fmtSize = useNumberFormatter()
	const step = useAppStore(s => s.step)
	const setStep = useAppStore(s => s.setStep)
	const ringForm = useAppStore(s => s.ringForm)
	const reliefDetail = useAppStore(s => s.reliefDetail)
	const ringSize = useAppStore(s => s.ringSize)
	const location = useAppStore(s => s.location)
	const [previewOverride, setPreviewOverride] = useState<boolean | null>(null)
	const [shortScreen, setShortScreen] = useState(false)
	const contentRef = useRef<HTMLDivElement>(null)
	const reduceMotion = useReducedMotion()
	const stepIndex = STEPS.indexOf(step)
	const sectionIndex = STUDIO_SECTIONS.findIndex(section => section.steps.includes(step))
	const section = STUDIO_SECTIONS[sectionIndex]
	const isLast = step === 'order'
	const previewExpanded = previewOverride ?? (!shortScreen && !isLast)
	const price = calcPrice({ ringForm, reliefDetail, ...RING_PRODUCTION_DEFAULTS })
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
			<header className={styles.header} data-admin={isAdmin}>
				<Link href="/" className="font-display text-2xl font-semibold tracking-tight">Favplace<span className="sr-only"> {t("— на главную")}</span></Link>
				<span className={styles.headerTitle}>{t("Создать своё кольцо")}</span>
				<div className={styles.headerActions}>
					<HeaderPreferences />
					{isAdmin && <StlExportButton />}
					<button type="button" onClick={() => setPreviewOverride(!previewExpanded)} aria-expanded={previewExpanded} aria-controls="ring-preview" className={styles.previewToggle}>
						<span className="sr-only">{previewExpanded ? t('Скрыть') : t('Показать')} </span>3D {previewExpanded ? '↑' : '↓'}
					</button>
					<button type="button" onClick={onShare} className={styles.share} aria-live="polite" aria-label={shared ? t('Ссылка скопирована') : t('Поделиться')}>
						<span aria-hidden="true">{shared ? '✓' : '↗'}</span><span className={styles.shareLabel}>{shared ? t('Скопировано') : t('Поделиться')}</span>
					</button>
				</div>
			</header>

			<div className={styles.navigation}><StepProgress /></div>

			<ResizableWorkspace>
				<section id="studio-result" className={styles.result} aria-label={t("Предпросмотр и параметры кольца")}>
					<div className={styles.resultHeading}>
						<h1 className="font-display text-xl font-semibold">{t("Горное кольцо")}</h1>
						<span className={styles.modelHint}>{t("Вращайте, чтобы рассмотреть")}</span>
					</div>
					<section id="ring-preview" aria-label={t("3D-превью кольца")} className={styles.preview} data-expanded={previewExpanded} data-preview-mode={previewOverride === null ? 'auto' : 'manual'}>
						<CanvasMouseHint><FormRingViewer className="h-full w-full" /></CanvasMouseHint>
						{fetching && <div role="status" className={styles.loading}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900" />{t("Уточняем высоты")}</div>}
						<p className={styles.previewHint}>{t("Вращайте кольцо пальцем · приближайте двумя")}</p>
					</section>
					<dl className={styles.summary}>
						<div className={styles.summaryPlace}><dt>{t("Место")}</dt><dd>{location ? t(location.name) : t('Выберите точку на карте')}</dd></div>
						<div><dt>{t("Изделие")}</dt><dd>{t("Серебряное кольцо")}</dd></div>
						<div><dt>{t("Размер")}</dt><dd>⌀ {fmtSize(ringSize)} {t("мм")}</dd></div>
					</dl>
				</section>

				<section id="studio-settings" aria-label={t("Настройки кольца")} className={styles.panel}>
					<div className={styles.panelHeading}>
						<p className={styles.eyebrow}>0{sectionIndex + 1} / {t(section.title)}</p>
						{section.steps.length > 1 && <nav aria-label={t("Параметры раздела")} className={styles.subNavigation}>
							{section.steps.map(id => <button key={id} type="button" onClick={() => setStep(id)} aria-current={id === step ? 'step' : undefined}>{t(STUDIO_STEP_TITLES[id])}</button>)}
						</nav>}
					</div>
					<div ref={contentRef} className={styles.content}>
						<AnimatePresence initial={false} mode="wait" onExitComplete={() => contentRef.current?.scrollTo({ top: 0 })}>
							<motion.div key={step} data-studio-step={step}
								initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
								animate={{ opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : .22, ease: [.22, 1, .36, 1] } }}
								exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -4, transition: { duration: reduceMotion ? 0 : .1 } }}>
								{children}
							</motion.div>
						</AnimatePresence>
					</div>
				</section>
			</ResizableWorkspace>

			<footer className={styles.footer}>
				<div className={styles.footerInner}>
					<div className={styles.price}><span>{t("Стоимость кольца")}</span><strong className="font-display">{formatPrice(price.total)}</strong></div>
					<div className={styles.footerControls}>
						{stepIndex > 0 && <button type="button" onClick={() => setStep(STEPS[stepIndex - 1])} aria-label={t("Предыдущий шаг")} className={styles.back}><span aria-hidden="true">←</span><span className={styles.backLabel}>{t("Назад")}</span></button>}
						{!isLast && <button type="button" onClick={() => setStep(next)} className={styles.next}>{next === 'order' ? t('Проверить и оформить') : t(STUDIO_STEP_TITLES[next])} <span aria-hidden="true">→</span></button>}
						{isLast && <span className={styles.orderHint}>{t("Без оплаты сейчас")}</span>}
					</div>
				</div>
			</footer>
		</div>
	)
}
