'use client'

import { useAppStore, type ReliefDetail } from '@/store/useAppStore'
import { FormRingViewer, RING_FORM_OPTIONS } from './FormRingViewer'

export function FormStep() {
	const {
		ringForm,
		setRingForm,
		reliefHeight,
		setReliefHeight,
		reliefDetail,
		setReliefDetail,
		mountainTwoTone,
		setMountainTwoTone,
		heightMap,
		elevationMeta,
		setStep,
	} = useAppStore()

	const formMeta = RING_FORM_OPTIONS.find(o => o.id === ringForm)

	return (
		<div className="flex h-full flex-col lg:flex-row">
			<div className="relative flex-1 bg-zinc-100">
				<FormRingViewer className="h-full w-full" />
				{!heightMap && (
					<div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-white/90 px-3 py-2 text-xs text-zinc-600 shadow-sm">
						Демо-рельеф — сначала выберите место на шаге «Место и рельеф»
					</div>
				)}
			</div>

			<div className="flex shrink-0 flex-col gap-8 overflow-y-auto border-t border-zinc-200 bg-white p-6 lg:w-[38%] lg:border-l lg:border-t-0">
				<div>
					<h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
						Форма и рельеф
					</h2>
					<p className="mt-1 text-sm text-zinc-500">
						{formMeta?.hint ?? 'Выберите силуэт кольца и настройте рельеф'}
					</p>
				</div>

				<div className="space-y-3">
					<span className="text-xs uppercase tracking-wider text-zinc-400">
						Форма кольца
					</span>
					<div className="grid grid-cols-2 gap-2">
						{RING_FORM_OPTIONS.map(opt => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setRingForm(opt.id)}
								className={`rounded-lg border px-2 py-2.5 text-center text-sm font-medium transition ${
									ringForm === opt.id
										? 'border-zinc-900 bg-zinc-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
					<p className="text-xs leading-relaxed text-zinc-400">
						{ringForm === 'disc' &&
							'Обруч и круглая вставка состыкованы жёстко — вертикальная стенка, рельеф только сверху.'}
						{ringForm === 'plug' &&
							'Толще круглый обруч и круглая вставка.'}
						{ringForm === 'bar' &&
							'Прямоугольная планка по ширине обруча — низ уходит в обруч, без отдельных скосов.'}
						{ringForm === 'mountain' &&
							'Плато продолжает обруч: рельеф на поверхности, без отдельной «коробки».'}
						{ringForm === 'classic' &&
							'Классический сигнет с овальной площадкой под карту.'}
						{ringForm === 'square' &&
							'Базовая модель: квадратная площадка, рельеф сверху.'}
						{ringForm === 'circle' &&
							'Базовая модель: круглая площадка, рельеф сверху.'}
						{ringForm === 'oval' &&
							'Базовая модель: овальная площадка, рельеф сверху.'}
					</p>
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
						min={0.4}
						max={3}
						step={0.1}
						value={reliefHeight}
						onChange={e => setReliefHeight(parseFloat(e.target.value))}
						className="w-full"
					/>
				</div>

				<div className="space-y-2">
					<span className="text-xs uppercase tracking-wider text-zinc-400">
						Детализация
					</span>
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

				{(ringForm === 'mountain' ||
					ringForm === 'disc' ||
					ringForm === 'plug' ||
					ringForm === 'bar') && (
					<div className="space-y-3">
						<span className="text-xs uppercase tracking-wider text-zinc-400">
							Отделка рельефа
						</span>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setMountainTwoTone(false)}
								className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
									!mountainTwoTone
										? 'border-zinc-900 bg-zinc-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
								}`}
							>
								Единый металл
							</button>
							<button
								type="button"
								onClick={() => setMountainTwoTone(true)}
								className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
									mountainTwoTone
										? 'border-zinc-900 bg-zinc-50 text-zinc-900'
										: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
								}`}
							>
								Двухцветный
							</button>
						</div>
					</div>
				)}

				{elevationMeta && (
					<p className="text-xs text-zinc-400">
						Рельеф: {Math.round(elevationMeta.min)}–{Math.round(elevationMeta.max)} м
					</p>
				)}

				<div className="mt-auto flex gap-2 pt-4">
					<button
						onClick={() => setStep('studio')}
						className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
					>
						Назад
					</button>
					<button
						onClick={() => setStep('material')}
						className="flex-1 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
					>
						Материал →
					</button>
				</div>
			</div>
		</div>
	)
}
