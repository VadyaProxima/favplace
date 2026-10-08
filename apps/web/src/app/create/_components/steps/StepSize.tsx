'use client'

import { useAppStore } from '@/store/useAppStore'
import {
	RING_SIZES_MM,
	nearestRingSize,
	ringCircumference,
	ringDiameterFromCircumference,
} from '@favplace/shared'
import { useState } from 'react'
import { ChoiceButton, FieldLabel, Hint, StepHeading } from '../ui'

const fmt = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '')

export function StepSize() {
	const ringSize = useAppStore(s => s.ringSize)
	const setRingSize = useAppStore(s => s.setRingSize)

	const [mode, setMode] = useState<'known' | 'measure'>('known')
	const [measured, setMeasured] = useState('')

	const measuredNum = parseFloat(measured.replace(',', '.'))
	const measuredValid = Number.isFinite(measuredNum) && measuredNum >= 40 && measuredNum <= 80
	const measuredDiameter = measuredValid
		? ringDiameterFromCircumference(measuredNum)
		: null

	return (
		<div className="space-y-8">
			<StepHeading
				title="Размер"
				hint="Указывается внутренний диаметр шинки в миллиметрах."
			/>

			<div className="grid grid-cols-2 gap-2">
				<ChoiceButton selected={mode === 'known'} onClick={() => setMode('known')}>
					Знаю свой размер
				</ChoiceButton>
				<ChoiceButton selected={mode === 'measure'} onClick={() => setMode('measure')}>
					Измерить
				</ChoiceButton>
			</div>

			{mode === 'known' ? (
				<div>
					<FieldLabel>Внутренний диаметр</FieldLabel>
					<div className="mt-2 grid grid-cols-4 gap-2">
						{RING_SIZES_MM.map(size => (
							<ChoiceButton
								key={size}
								selected={ringSize === size}
								onClick={() => setRingSize(size)}
								className="tabular-nums"
							>
								{fmt(size)}
							</ChoiceButton>
						))}
					</div>
				</div>
			) : (
				<div>
					<FieldLabel>Длина окружности пальца, мм</FieldLabel>
					<input
						type="text"
						inputMode="decimal"
						value={measured}
						onChange={e => setMeasured(e.target.value)}
						placeholder="например 54,5"
						className="mt-2 w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none"
					/>
					<Hint>
						Оберните полоску бумаги вокруг основания пальца, отметьте место стыка и
						измерьте длину линейкой. Мерьте вечером — к концу дня палец чуть полнее.
					</Hint>

					{measuredDiameter !== null && (
						<div className="mt-4 border border-zinc-200 bg-zinc-50 p-4">
							<p className="text-sm text-zinc-700">
								Диаметр {fmt(measuredDiameter)} мм · ближайший размер{' '}
								<span className="font-medium">
									{fmt(nearestRingSize(measuredDiameter))} мм
								</span>
							</p>
							<button
								type="button"
								onClick={() => setRingSize(nearestRingSize(measuredDiameter))}
								className="mt-3 w-full bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
							>
								Взять этот размер
							</button>
						</div>
					)}
					{measured.trim() !== '' && !measuredValid && (
						<p className="mt-2 text-xs text-red-500">
							Введите число от 40 до 80 мм.
						</p>
					)}
				</div>
			)}

			<div className="border-t border-zinc-200 pt-4 text-sm text-zinc-500">
				<p>
					Выбрано: <span className="text-zinc-900">⌀ {fmt(ringSize)} мм</span>
				</p>
				<p className="mt-0.5 text-zinc-400">
					Окружность {fmt(ringCircumference(ringSize))} мм
				</p>
			</div>
		</div>
	)
}
