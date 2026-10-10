'use client'

import { useT } from '@/lib/preferences'

import { useAppStore } from '@/store/useAppStore'
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

/** Параметры единственной доступной модели — горного кольца. */
export function StepForm() {
	const t = useT()
	const ringForm = useAppStore(s => s.ringForm)
	const ringWeight = useAppStore(s => s.ringWeight)
	const setRingWeight = useAppStore(s => s.setRingWeight)
	const bandProfile = useAppStore(s => s.bandProfile)
	const setBandProfile = useAppStore(s => s.setBandProfile)
	const shoulderStyle = useAppStore(s => s.shoulderStyle)
	const setShoulderStyle = useAppStore(s => s.setShoulderStyle)

	return (
		<div>
			<StepHeading
				title={t("Характер кольца")}
				hint={t("Настройте массу, профиль и посадку горного кольца.")}
			/>

			{ringForm === 'mountain' && (
				<div className="space-y-6">
					<div>
						<FieldLabel>{t("Масса")}</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{WEIGHTS.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={ringWeight === value}
									onClick={() => setRingWeight(value)}
								>
									{t(label)}
								</ChoiceButton>
							))}
						</div>
						<Hint>{t("Ширина шинки и размер площадки под рельеф.")}</Hint>
					</div>

					<div>
						<FieldLabel>{t("Профиль шинки")}</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{PROFILES.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={bandProfile === value}
									onClick={() => setBandProfile(value)}
								>
									{t(label)}
								</ChoiceButton>
							))}
						</div>
					</div>

					<div>
						<FieldLabel>{t("Плечи")}</FieldLabel>
						<div className="mt-2 grid grid-cols-3 gap-2">
							{SHOULDERS.map(([value, label]) => (
								<ChoiceButton
									key={value}
									selected={shoulderStyle === value}
									onClick={() => setShoulderStyle(value)}
								>
									{t(label)}
								</ChoiceButton>
							))}
						</div>
						<Hint>{t("Как площадка переходит в шинку по бокам.")}</Hint>
					</div>
				</div>
			)}
		</div>
	)
}
