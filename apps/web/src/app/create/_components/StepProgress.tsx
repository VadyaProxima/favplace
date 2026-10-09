'use client'

import { STEPS, STEP_LABELS, useAppStore } from '@/store/useAppStore'

/** Нижняя лента шагов: сегмент-индикатор + кликабельный переход. */
export function StepProgress() {
	const step = useAppStore(s => s.step)
	const setStep = useAppStore(s => s.setStep)
	const current = STEPS.indexOf(step)

	return (
		<nav aria-label="Шаги конструктора" className="flex min-w-0 flex-1 items-end gap-1 lg:gap-2">
			{STEPS.map((id, i) => {
				const active = i === current
				const passed = i < current
				return (
					<button
						key={id}
						type="button"
						onClick={() => setStep(id)}
						aria-current={active ? 'step' : undefined}
						aria-label={`Шаг: ${STEP_LABELS[id]}`}
						className="group flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1.5 lg:gap-2"
					>
						<span
							className={`h-[3px] w-full transition-colors ${
								active
									? 'bg-zinc-900'
									: passed
										? 'bg-zinc-400'
										: 'bg-zinc-200 group-hover:bg-zinc-300'
							}`}
						/>
						<span
							className={`truncate text-[11px] tracking-wide transition-colors ${
								active
									? 'font-medium text-zinc-900'
									: 'text-zinc-400 group-hover:text-zinc-600'
							}`}
						>
							{STEP_LABELS[id]}
						</span>
					</button>
				)
			})}
		</nav>
	)
}
