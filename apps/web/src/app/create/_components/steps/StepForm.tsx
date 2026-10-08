'use client'

import { useAppStore } from '@/store/useAppStore'
import { formFromPrice, formatPrice } from '@favplace/shared'
import { RING_FORM_OPTIONS } from '../FormRingViewer'
import { ChoiceButton, FieldLabel, Hint, StepHeading } from '../ui'

const WEIGHTS = [
	['subtle', 'Лёгкое'],
	['classic', 'Классика'],
	['statement', 'Массивное'],
] as const

const PROFILES = [
	['flat', 'Плоский'],
	['classic', 'Классика'],
	['d-shaped', 'D-форма'],
] as const

const SHOULDERS = [
	['straight', 'Прямые'],
	['classic', 'Классика'],
	['curved', 'Плавные'],
] as const

/** Шаг 1 — форма изделия. Цена «от» считается для серебра и низкой детализации. */
export function StepForm() {
	const ringForm = useAppStore(s => s.ringForm)
	const setRingForm = useAppStore(s => s.setRingForm)
	const ringWeight = useAppStore(s => s.ringWeight)
	const setRingWeight = useAppStore(s => s.setRingWeight)
	const bandProfile = useAppStore(s => s.bandProfile)
	const setBandProfile = useAppStore(s => s.setBandProfile)
	const shoulderStyle = useAppStore(s => s.shoulderStyle)
	const setShoulderStyle = useAppStore(s => s.setShoulderStyle)

	return (
		<div>
			<StepHeading
				title="Форма"
				hint="Настройте массу, профиль и посадку горного кольца."
			/>

			<div className="space-y-2">
				{RING_FORM_OPTIONS.map(opt => {
					const selected = ringForm === opt.id
					return (
						<button
							key={opt.id}
							type="button"
							onClick={() => setRingForm(opt.id)}
							aria-pressed={selected}
							className={`flex w-full items-center justify-between gap-4 border px-4 py-3.5 text-left transition ${
								selected
									? 'border-zinc-900 bg-zinc-50'
									: 'border-zinc-200 hover:border-zinc-400'
							}`}
						>
							<span className="min-w-0">
								<span
									className={`block text-sm font-medium ${
										selected ? 'text-zinc-900' : 'text-zinc-700'
									}`}
								>
									{opt.label}
								</span>
								<span className="mt-0.5 block text-xs leading-snug text-zinc-400">
									{opt.hint}
								</span>
							</span>
							<span className="shrink-0 text-xs tabular-nums text-zinc-400">
								от {formatPrice(formFromPrice(opt.id))}
							</span>
						</button>
					)
				})}
			</div>

			{ringForm === 'mountain' && (
				<div className="mt-8 space-y-6 border-t border-zinc-200 pt-6">
					<div>
						<FieldLabel>Масса</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{WEIGHTS.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={ringWeight === value}
									onClick={() => setRingWeight(value)}
								>
									{label}
								</ChoiceButton>
							))}
						</div>
						<Hint>Ширина шинки и размер площадки под рельеф.</Hint>
					</div>

					<div>
						<FieldLabel>Профиль шинки</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{PROFILES.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={bandProfile === value}
									onClick={() => setBandProfile(value)}
								>
									{label}
								</ChoiceButton>
							))}
						</div>
					</div>

					<div>
						<FieldLabel>Плечи</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{SHOULDERS.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={shoulderStyle === value}
									onClick={() => setShoulderStyle(value)}
								>
									{label}
								</ChoiceButton>
							))}
						</div>
						<Hint>Как площадка переходит в шинку по бокам.</Hint>
					</div>
				</div>
			)}
		</div>
	)
}
