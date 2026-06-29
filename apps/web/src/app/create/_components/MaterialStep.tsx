'use client'

import { useAppStore } from '@/store/useAppStore'
import {
	MATERIALS,
	type MaterialType,
	type SurfaceFinish,
} from '@favplace/shared'
import { RingViewer } from './RingViewer'

const MATERIAL_KEYS: MaterialType[] = ['gold', 'silver', 'platinum']

export function MaterialStep() {
	const {
		material,
		setMaterial,
		surfaceFinish,
		setSurfaceFinish,
		ringWidth,
		setRingWidth,
		reliefHeight,
		setReliefHeight,
		setStep,
	} = useAppStore()

	return (
		<div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
			<h2 className="text-3xl font-bold">Настройте кольцо</h2>

			<div className="h-72 w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
				<RingViewer className="h-full w-full" />
			</div>

			<div className="w-full max-w-lg space-y-8">
				<div className="space-y-3">
					<h3 className="text-sm font-medium text-zinc-400">Материал</h3>
					<div className="grid grid-cols-3 gap-3">
						{MATERIAL_KEYS.map(key => {
							const mat = MATERIALS[key]
							return (
								<button
									key={key}
									onClick={() => setMaterial(key)}
									className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition ${
										material === key
											? 'border-amber-500 bg-amber-500/10'
											: 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
									}`}
								>
									<div
										className="h-10 w-10 rounded-full shadow-lg"
										style={{ background: mat.color }}
									/>
									<span className="text-sm font-medium">{mat.label}</span>
								</button>
							)
						})}
					</div>
				</div>

				<div className="space-y-3">
					<h3 className="text-sm font-medium text-zinc-400">Поверхность</h3>
					<div className="grid grid-cols-2 gap-3">
						{(['polished', 'matte'] as SurfaceFinish[]).map(finish => (
							<button
								key={finish}
								onClick={() => setSurfaceFinish(finish)}
								className={`rounded-lg border p-3 text-sm font-medium transition ${
									surfaceFinish === finish
										? 'border-amber-500 bg-amber-500/10'
										: 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
								}`}
							>
								{finish === 'polished' ? 'Полированная' : 'Матовая'}
							</button>
						))}
					</div>
				</div>

				<div className="space-y-3">
					<div className="flex justify-between">
						<h3 className="text-sm font-medium text-zinc-400">Ширина кольца</h3>
						<span className="text-sm text-zinc-300">{ringWidth} мм</span>
					</div>
					<input
						type="range"
						min={2}
						max={8}
						step={0.5}
						value={ringWidth}
						onChange={e => setRingWidth(parseFloat(e.target.value))}
						className="w-full accent-amber-500"
					/>
				</div>

				<div className="space-y-3">
					<div className="flex justify-between">
						<h3 className="text-sm font-medium text-zinc-400">
							Высота рельефа
						</h3>
						<span className="text-sm text-zinc-300">{reliefHeight} мм</span>
					</div>
					<input
						type="range"
						min={0.5}
						max={3}
						step={0.25}
						value={reliefHeight}
						onChange={e => setReliefHeight(parseFloat(e.target.value))}
						className="w-full accent-amber-500"
					/>
				</div>
			</div>

			<div className="flex gap-3">
				<button
					onClick={() => setStep('preview')}
					className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-800"
				>
					Назад
				</button>
				<button
					onClick={() => setStep('engraving')}
					className="rounded-lg bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
				>
					Гравировка
				</button>
			</div>
		</div>
	)
}
