'use client'

import { useAppStore, type Step } from '@/store/useAppStore'

const STEPS: { key: Step; label: string }[] = [
	{ key: 'studio', label: 'Место и рельеф' },
	{ key: 'form', label: 'Форма' },
	{ key: 'material', label: 'Материал' },
	{ key: 'engraving', label: 'Гравировка' },
	{ key: 'summary', label: 'Итог' },
]

export function StepNavigator() {
	const { step, setStep } = useAppStore()
	const currentIndex = STEPS.findIndex(s => s.key === step)

	return (
		<nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
			<a href="/" className="flex items-center gap-2">
				<div className="h-5 w-5 rounded-sm bg-zinc-900" />
				<span className="text-sm font-semibold tracking-tight text-zinc-900">favplace</span>
			</a>
			<div className="flex items-center gap-1 sm:gap-2">
				{STEPS.map((s, i) => (
					<button
						key={s.key}
						onClick={() => setStep(s.key)}
						className={`flex items-center gap-2 text-xs font-medium transition ${
							i === currentIndex
								? 'text-zinc-900'
								: i < currentIndex
									? 'text-zinc-500 hover:text-zinc-800'
									: 'text-zinc-400'
						}`}
					>
						<span
							className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
								i === currentIndex
									? 'bg-zinc-900 text-white'
									: i < currentIndex
										? 'bg-zinc-300 text-zinc-700'
										: 'bg-zinc-200 text-zinc-400'
							}`}
						>
							{i + 1}
						</span>
						<span className="hidden md:inline">{s.label}</span>
					</button>
				))}
			</div>
			<div className="w-[88px]" />
		</nav>
	)
}
