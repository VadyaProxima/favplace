'use client'

import { useAppStore } from '@/store/useAppStore'
import { MATERIALS } from '@favplace/shared'
import { useState } from 'react'
import { FormRingViewer, RING_FORM_OPTIONS } from './FormRingViewer'

export function SummaryStep() {
	const {
		location,
		radius,
		material,
		surfaceFinish,
		ringForm,
		engraving,
		elevationMeta,
		heightMap,
		reliefHeight,
		setStep,
	} = useAppStore()
	const [exporting, setExporting] = useState(false)

	const exportSTL = async () => {
		if (!heightMap) return
		setExporting(true)
		try {
			const res = await fetch('/api/export/stl', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					heightMap,
					ringRadius: 1,
					tubeRadius: 0.05,
					reliefHeight,
					segments: 256,
				}),
			})
			const blob = await res.blob()
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `favplace-${location?.name ?? 'relief'}.stl`
			a.click()
			URL.revokeObjectURL(url)
		} finally {
			setExporting(false)
		}
	}

	const rows = [
		location && { label: 'Место', value: `${location.name}, ${location.country}` },
		{ label: 'Масштаб', value: radius >= 1000 ? `${radius / 1000} км` : `${radius} м` },
		{
			label: 'Форма',
			value: RING_FORM_OPTIONS.find(o => o.id === ringForm)?.label ?? ringForm,
		},
		{ label: 'Металл', value: MATERIALS[material].label },
		{ label: 'Поверхность', value: surfaceFinish === 'polished' ? 'Полированная' : 'Матовая' },
		elevationMeta && {
			label: 'Рельеф',
			value: `${Math.round(elevationMeta.min)}–${Math.round(elevationMeta.max)} м · высота ${reliefHeight.toFixed(1)}`,
		},
		engraving && { label: 'Гравировка', value: engraving },
	].filter(Boolean) as { label: string; value: string }[]

	return (
		<div className="flex h-full flex-col lg:flex-row">
			<div className="relative flex flex-1 flex-col bg-zinc-100">
				<FormRingViewer className="h-full w-full" />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-zinc-100 to-transparent px-6 pb-8 pt-20 text-center">
					<h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Ваше место навсегда с вами</h2>
					{location && (
						<p className="font-mono text-xs text-zinc-500">
							{location.coordinates.lat.toFixed(5)}°, {location.coordinates.lng.toFixed(5)}°
						</p>
					)}
				</div>
			</div>

			<div className="flex shrink-0 flex-col gap-6 overflow-y-auto border-t border-zinc-200 bg-white p-6 lg:w-[38%] lg:border-l lg:border-t-0">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Итог</h2>
					<p className="mt-1 text-sm text-zinc-500">Проверьте детали перед заказом</p>
				</div>

				<dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
					{rows.map(r => (
						<div key={r.label} className="flex items-center justify-between px-4 py-2.5">
							<dt className="text-sm text-zinc-500">{r.label}</dt>
							<dd className="text-sm font-medium text-zinc-900">{r.value}</dd>
						</div>
					))}
				</dl>

				<div className="mt-auto space-y-2">
					<button className="w-full rounded-md bg-zinc-900 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-700">
						Оформить заказ
					</button>
					<button
						onClick={exportSTL}
						disabled={!heightMap || exporting}
						className="w-full rounded-md border border-zinc-300 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40"
					>
						{exporting ? 'Генерируем…' : 'Скачать STL для 3D-печати'}
					</button>
					<button
						onClick={() => setStep('studio')}
						className="w-full rounded-md py-2.5 text-sm text-zinc-400 transition hover:text-zinc-700"
					>
						Изменить место
					</button>
				</div>
			</div>
		</div>
	)
}
