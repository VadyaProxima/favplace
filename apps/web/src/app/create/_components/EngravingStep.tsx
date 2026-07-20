'use client'

import { useAppStore } from '@/store/useAppStore'

export function EngravingStep() {
	const { engraving, setEngraving, setStep } = useAppStore()

	return (
		<div className="flex h-full flex-col items-center justify-center gap-10 bg-white px-6 py-10">
			<div className="text-center">
				<h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Гравировка внутри</h2>
				<p className="mt-1 text-sm text-zinc-500">До 30 символов — дата, имена, координаты</p>
			</div>

			<div className="w-full max-w-md space-y-3">
				<input
					value={engraving}
					onChange={e => setEngraving(e.target.value.slice(0, 30))}
					placeholder="18.07.2024"
					maxLength={30}
					className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center text-lg tracking-wide text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
				/>
				<div className="text-center text-xs tabular-nums text-zinc-400">
					{engraving.length}/30
				</div>

				{engraving && (
					<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
						<div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-400">
							Предпросмотр
						</div>
						<div className="font-serif text-xl tracking-[0.2em] text-zinc-900">
							{engraving}
						</div>
					</div>
				)}
			</div>

			<div className="flex w-full max-w-md gap-2">
				<button
					onClick={() => setStep('material')}
					className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
				>
					Назад
				</button>
				<button
					onClick={() => setStep('summary')}
					className="flex-1 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
				>
					К итогу →
				</button>
			</div>
		</div>
	)
}
