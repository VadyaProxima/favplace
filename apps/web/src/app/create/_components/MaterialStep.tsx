'use client'

import { useAppStore, type ReliefDetail } from '@/store/useAppStore'
import { MATERIALS, type MaterialType, type SurfaceFinish } from '@favplace/shared'
import { FormRingViewer, RING_FORM_OPTIONS } from './FormRingViewer'

const MATERIAL_KEYS: MaterialType[] = ['gold', 'silver', 'platinum']

export function MaterialStep() {
	const {
		material,
		setMaterial,
		surfaceFinish,
		setSurfaceFinish,
		ringForm,
		reliefHeight,
		setReliefHeight,
		reliefDetail,
		setReliefDetail,
		setStep,
	} = useAppStore()

	return (
		<div className="flex h-full flex-col lg:flex-row">
			<div className="relative flex-1 bg-zinc-100">
				<FormRingViewer className="h-full w-full" />
			</div>

			<div className="flex shrink-0 flex-col gap-8 overflow-y-auto border-t border-zinc-200 bg-white p-6 lg:w-[38%] lg:border-l lg:border-t-0">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Материал</h2>
					<p className="mt-1 text-sm text-zinc-500">
						{RING_FORM_OPTIONS.find(o => o.id === ringForm)?.label ?? 'Кольцо'} · как
						будет ощущаться изделие
					</p>
				</div>

				<div className="space-y-3">
					<span className="text-xs uppercase tracking-wider text-zinc-400">Металл</span>
					<div className="grid grid-cols-3 gap-2">
						{MATERIAL_KEYS.map(key => {
							const m = MATERIALS[key]
							return (
								<button
									key={key}
									onClick={() => setMaterial(key)}
									className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
										material === key
											? 'border-zinc-900 bg-zinc-50'
											: 'border-zinc-200 hover:border-zinc-400'
									}`}
								>
									<span
										className="h-9 w-9 rounded-full"
										style={{ background: m.color, boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.2)' }}
									/>
									<span className="text-xs font-medium text-zinc-800">{m.label}</span>
								</button>
							)
						})}
					</div>
				</div>

				<div className="space-y-3">
					<span className="text-xs uppercase tracking-wider text-zinc-400">Поверхность</span>
					<div className="grid grid-cols-2 gap-2">
						{(['polished', 'matte'] as SurfaceFinish[]).map(finish => (
							<button
								key={finish}
								onClick={() => setSurfaceFinish(finish)}
								className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
									surfaceFinish === finish
										? 'border-zinc-900 bg-zinc-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
								}`}
							>
								{finish === 'polished' ? 'Полированная' : 'Матовая'}
							</button>
						))}
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs uppercase tracking-wider text-zinc-400">
							Высота рельефа
						</span>
						<span className="text-sm tabular-nums text-zinc-700">
							{reliefHeight.toFixed(2)}
						</span>
					</div>
					<input
						type="range"
						min={0.1}
						max={3}
						step={0.1}
						value={reliefHeight}
						onChange={e => setReliefHeight(parseFloat(e.target.value))}
						className="w-full"
					/>
				</div>

				<div className="space-y-2">
					<span className="text-xs uppercase tracking-wider text-zinc-400">Детализация</span>
					<div className="grid grid-cols-3 gap-2">
						{(['low', 'medium', 'high'] as ReliefDetail[]).map(d => (
							<button
								key={d}
								type="button"
								onClick={() => setReliefDetail(d)}
								className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
									reliefDetail === d
										? 'border-zinc-900 bg-zinc-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
								}`}
							>
								{d === 'low' ? 'Низкая' : d === 'medium' ? 'Средняя' : 'Высокая'}
							</button>
						))}
					</div>
				</div>

				<div className="mt-auto flex gap-2 pt-4">
					<button
						onClick={() => setStep('form')}
						className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
					>
						Назад
					</button>
					<button
						onClick={() => setStep('engraving')}
						className="flex-1 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
					>
						Гравировка →
					</button>
				</div>
			</div>
		</div>
	)
}
