'use client'

import { useAppStore } from '@/store/useAppStore'
import {
	MATERIALS,
	TWO_TONE_PRICE,
	formatPrice,
	type MaterialType,
	type SurfaceFinish,
} from '@favplace/shared'
import { ChoiceButton, FieldLabel, Hint, StepHeading } from '../ui'

const MATERIAL_KEYS: MaterialType[] = ['silver', 'gold', 'platinum']

/** Двухцветная отделка осмысленна только там, где рельеф — отдельная площадка. */
const TWO_TONE_FORMS = ['mountain', 'disc', 'plug', 'bar']

export function StepMaterial() {
	const {
		ringForm,
		material,
		setMaterial,
		surfaceFinish,
		setSurfaceFinish,
		mountainTwoTone,
		setMountainTwoTone,
	} = useAppStore()

	return (
		<div className="space-y-8">
			<StepHeading title="Материал" hint="Металл задаёт и цену, и характер бликов." />

			<div>
				<FieldLabel>Металл</FieldLabel>
				<div className="mt-2 grid grid-cols-3 gap-2">
					{MATERIAL_KEYS.map(key => {
						const m = MATERIALS[key]
						const selected = material === key
						return (
							<button
								key={key}
								type="button"
								onClick={() => setMaterial(key)}
								aria-pressed={selected}
								className={`flex flex-col items-center gap-2 border p-3 transition ${
									selected
										? 'border-zinc-900 bg-zinc-50'
										: 'border-zinc-200 hover:border-zinc-400'
								}`}
							>
								<span
									className="h-8 w-8 rounded-full"
									style={{
										background: m.color,
										boxShadow: 'inset 0 -2px 5px rgba(0,0,0,0.2)',
									}}
								/>
								<span className="text-xs font-medium text-zinc-800">{m.label}</span>
							</button>
						)
					})}
				</div>
			</div>

			<div>
				<FieldLabel>Поверхность</FieldLabel>
				<div className="mt-2 grid grid-cols-2 gap-2">
					{(['polished', 'matte'] as SurfaceFinish[]).map(finish => (
						<ChoiceButton
							key={finish}
							selected={surfaceFinish === finish}
							onClick={() => setSurfaceFinish(finish)}
						>
							{finish === 'polished' ? 'Полированная' : 'Матовая'}
						</ChoiceButton>
					))}
				</div>
			</div>

			{TWO_TONE_FORMS.includes(ringForm) && (
				<div>
					<FieldLabel aside={`+${formatPrice(TWO_TONE_PRICE)}`}>
						Отделка рельефа
					</FieldLabel>
					<div className="mt-2 grid grid-cols-2 gap-2">
						<ChoiceButton
							selected={!mountainTwoTone}
							onClick={() => setMountainTwoTone(false)}
						>
							Единый металл
						</ChoiceButton>
						<ChoiceButton
							selected={mountainTwoTone}
							onClick={() => setMountainTwoTone(true)}
						>
							Двухцветный
						</ChoiceButton>
					</div>
					<Hint>Полированная шинка и светлый матовый рельеф — контраст фактур.</Hint>
				</div>
			)}
		</div>
	)
}
