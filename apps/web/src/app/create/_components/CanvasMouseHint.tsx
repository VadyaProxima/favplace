'use client'

import { useT } from '@/lib/preferences'

import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './CreateStudio.module.css'

type Point = { x: number; y: number }

export function CanvasMouseHint({ children }: { children: ReactNode }) {
	const t = useT()
	const id = useId()
	const seen = useRef(false)
	const visible = useRef(false)
	const cursor = useRef<Point>({ x: 0, y: 0 })
	const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [point, setPoint] = useState<Point | null>(null)

	const hide = () => {
		visible.current = false
		setPoint(null)
		if (delay.current) clearTimeout(delay.current)
		if (timer.current) clearTimeout(timer.current)
		delay.current = timer.current = null
	}
	const show = (at: Point) => {
		hide()
		visible.current = true
		setPoint(at)
		timer.current = setTimeout(() => { seen.current = true; hide() }, 8000)
	}
	const follow = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== 'mouse' || !(event.target instanceof HTMLCanvasElement)) return
		if (event.buttons) { hide(); return }
		cursor.current = { x: event.clientX, y: event.clientY }
		if (visible.current) setPoint(cursor.current)
		else if (!seen.current && !delay.current) {
			delay.current = setTimeout(() => show(cursor.current), 250)
		}
	}
	const interact = () => {
		if (visible.current) seen.current = true
		hide()
	}
	useEffect(() => () => {
		if (delay.current) clearTimeout(delay.current)
		if (timer.current) clearTimeout(timer.current)
	}, [])

	return <>
		<div className={styles.mouseHintArea}
			onPointerOver={follow} onPointerMove={follow} onPointerLeave={hide}
			onPointerDownCapture={interact} onWheelCapture={interact}
			onKeyDown={event => { if (event.key === 'Escape') hide() }}>
			{children}
			<button type="button" className={styles.controlsHelp} aria-expanded={!!point}
				aria-describedby={point ? id : undefined}
				onClick={event => {
					const rect = event.currentTarget.getBoundingClientRect()
					show({ x: rect.right - 260, y: rect.bottom })
				}}
				onBlur={hide}>{t("Управление ")}<span aria-hidden="true">?</span></button>
		</div>
		{point && createPortal(<div id={id} role="tooltip" className={styles.mouseHint}
			style={{ left: Math.max(8, Math.min(point.x + 18, window.innerWidth - 248)), top: Math.max(8, Math.min(point.y + 18, window.innerHeight - 140)) }}>
			<p>{t("Управление 3D")}</p>
			<dl><div><dt>{t("ЛКМ")}</dt><dd>{t("Осмотр")}</dd></div><div><dt>{t("СКМ / ПКМ")}</dt><dd>{t("Перемещение")}</dd></div><div><dt>{t("Колесо")}</dt><dd>{t("Масштаб")}</dd></div></dl>
		</div>, document.body)}
	</>
}
