'use client'

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './CreateStudio.module.css'

const SEEN_KEY = 'favplace:canvas-controls-seen'

export function CanvasMouseHint({ children }: { children: ReactNode }) {
	const seen = useRef(false)
	const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const hide = () => { setPoint(null); if (timer.current) clearTimeout(timer.current) }

	useEffect(() => {
		try { seen.current = sessionStorage.getItem(SEEN_KEY) === '1' } catch { /* Show once for this mount. */ }
		return () => { if (timer.current) clearTimeout(timer.current) }
	}, [])

	const follow = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType !== 'mouse' || !(event.target instanceof HTMLCanvasElement)) return
		if (event.buttons) { hide(); return }
		if (point) setPoint({ x: event.clientX, y: event.clientY })
	}
	return <>
		<div className={styles.mouseHintArea}
			onPointerOver={event => {
				if (event.pointerType !== 'mouse' || event.buttons || seen.current || !(event.target instanceof HTMLCanvasElement)) return
				seen.current = true
				try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* The in-memory flag is sufficient. */ }
				setPoint({ x: event.clientX, y: event.clientY })
				timer.current = setTimeout(hide, 6000)
			}}
			onPointerMove={follow} onPointerLeave={hide} onPointerDownCapture={hide} onWheelCapture={hide}>
			{children}
		</div>
		{point && createPortal(<div role="tooltip" className={styles.mouseHint} style={{ left: Math.max(8, Math.min(point.x + 18, window.innerWidth - 248)), top: Math.max(8, Math.min(point.y + 18, window.innerHeight - 130)) }}>
			<p>Управление 3D</p>
			<dl><div><dt>ЛКМ</dt><dd>Осмотр</dd></div><div><dt>СКМ / ПКМ</dt><dd>Перемещение</dd></div><div><dt>Колесо</dt><dd>Масштаб</dd></div></dl>
		</div>, document.body)}
	</>
}
