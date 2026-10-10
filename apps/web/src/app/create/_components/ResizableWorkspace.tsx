'use client'

import { useT } from '@/lib/preferences'

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import styles from './CreateStudio.module.css'

const STORAGE_KEY = 'favplace:studio-split'
const DEFAULT_SPLIT = 45
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function ResizableWorkspace({ children }: { children: ReactNode }) {
	const t = useT()
	const workspace = useRef<HTMLElement>(null)
	const [split, setSplit] = useState(DEFAULT_SPLIT)
	const splitRef = useRef(DEFAULT_SPLIT)
	const [limits, setLimits] = useState({ min: 25, max: 75 })
	const [resizing, setResizing] = useState(false)
	const dragging = useRef(false)

	const updateSplit = (value: number, min = limits.min, max = limits.max) => {
		const next = clamp(value, min, max)
		splitRef.current = next
		setSplit(next)
	}
	const save = () => {
		try { localStorage.setItem(STORAGE_KEY, String(splitRef.current)) } catch { /* Storage may be unavailable. */ }
	}
	const measure = () => {
		const element = workspace.current
		if (!element || !window.matchMedia('(min-width: 1024px)').matches) return null
		const rect = element.getBoundingClientRect()
		const style = getComputedStyle(element)
		const left = rect.left + parseFloat(style.paddingLeft)
		const width = rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 24
		return { left, width, min: 360 / width * 100, max: (1 - 320 / width) * 100 }
	}

	useEffect(() => {
		try {
			const saved = Number(localStorage.getItem(STORAGE_KEY))
			if (saved > 0 && saved < 100) { splitRef.current = saved; setSplit(saved) }
		} catch { /* The default split still works. */ }
		const observer = new ResizeObserver(() => {
			const bounds = measure()
			if (!bounds) return
			setLimits({ min: bounds.min, max: bounds.max })
			updateSplit(splitRef.current, bounds.min, bounds.max)
		})
		if (workspace.current) observer.observe(workspace.current)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!resizing) return
		const cursor = document.documentElement.style.cursor
		const selection = document.body.style.userSelect
		document.documentElement.style.cursor = 'col-resize'
		document.body.style.userSelect = 'none'
		return () => {
			document.documentElement.style.cursor = cursor
			document.body.style.userSelect = selection
		}
	}, [resizing])

	const move = (event: PointerEvent<HTMLDivElement>) => {
		if (!dragging.current) return
		const bounds = measure()
		if (bounds) updateSplit((event.clientX - bounds.left - 12) / bounds.width * 100, bounds.min, bounds.max)
	}
	const finish = () => {
		if (!dragging.current) return
		dragging.current = false
		setResizing(false)
		save()
	}
	useEffect(() => {
		window.addEventListener('blur', finish)
		return () => window.removeEventListener('blur', finish)
	}, [])
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const bounds = measure()
		if (!bounds) return
		let next = splitRef.current
		if (event.key === 'ArrowLeft') next -= event.shiftKey ? 5 : 2
		else if (event.key === 'ArrowRight') next += event.shiftKey ? 5 : 2
		else if (event.key === 'Home') next = bounds.min
		else if (event.key === 'End') next = bounds.max
		else return
		event.preventDefault()
		updateSplit(next, bounds.min, bounds.max)
		save()
	}

	return (
		<main ref={workspace} className={styles.workspace} data-resizing={resizing} style={{ '--studio-split': split / 100 } as CSSProperties}>
			{children}
			<div role="separator" aria-label={t("Ширина панелей")} aria-orientation="vertical" aria-controls="studio-settings studio-result" aria-valuemin={Math.round(limits.min)} aria-valuemax={Math.round(limits.max)} aria-valuenow={Math.round(split)} aria-valuetext={`${t("Настройки")} ${Math.round(split)}%, ${t("превью")} ${100 - Math.round(split)}%`} tabIndex={0} className={styles.splitter}
				onPointerDown={event => {
					if (event.button !== 0 || !measure()) return
					event.preventDefault()
					event.currentTarget.focus()
					event.currentTarget.setPointerCapture(event.pointerId)
					dragging.current = true
					setResizing(true)
				}}
				onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={onKeyDown}
				onDoubleClick={() => { const bounds = measure(); if (bounds) { updateSplit(DEFAULT_SPLIT, bounds.min, bounds.max); save() } }}
				title={t("Перетащите для изменения ширины. Двойной щелчок — сброс.")}>
				<span aria-hidden="true">⋮</span>
			</div>
		</main>
	)
}
