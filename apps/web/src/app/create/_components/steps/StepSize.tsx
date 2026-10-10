'use client'

import { useT, useNumberFormatter } from '@/lib/preferences'

import { useAppStore } from '@/store/useAppStore'
import {
	RING_SIZES_MM,
	nearestRingSize,
	ringCircumference,
	ringDiameterFromCircumference,
} from '@favplace/shared'
import { useState } from 'react'
import { ChoiceButton, FieldLabel, Hint, StepHeading } from '../ui'

export function StepSize() {
	const t = useT()
	const fmt = useNumberFormatter()
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
				title={t("Размер")}
				hint={t("Указывается внутренний диаметр шинки в миллиметрах.")}
			/>

			<div className="grid grid-cols-2 gap-2">
				<ChoiceButton selected={mode === 'known'} onClick={() => setMode('known')}>
					{t("Знаю свой размер")}</ChoiceButton>
				<ChoiceButton selected={mode === 'measure'} onClick={() => setMode('measure')}>
					{t("Измерить")}</ChoiceButton>
			</div>

			{mode === 'known' ? (
				<div>
					<FieldLabel>{t("Внутренний диаметр")}</FieldLabel>
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
					<FieldLabel>{t("Длина окружности пальца, мм")}</FieldLabel>
					<input
						type="text"
						aria-label={t("Длина окружности пальца, мм")}
						inputMode="decimal"
						value={measured}
						onChange={e => setMeasured(e.target.value)}
						placeholder={t("например 54,5")}
						className="mt-2 min-h-11 w-full border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none lg:text-sm"
					/>
					<Hint>
						{t("Оберните полоску бумаги вокруг основания пальца, отметьте место стыка и измерьте длину линейкой. Мерьте вечером — к концу дня палец чуть полнее.")}</Hint>

					{measuredDiameter !== null && (
						<div className="mt-4 border border-zinc-200 bg-zinc-50 p-4">
							<p className="text-sm text-zinc-700">
								{t("Диаметр ")}{fmt(measuredDiameter)} {t("мм · ближайший размер")}{' '}
								<span className="font-medium">
									{fmt(nearestRingSize(measuredDiameter))} {t("мм")}</span>
							</p>
							<button
								type="button"
								onClick={() => setRingSize(nearestRingSize(measuredDiameter))}
								className="mt-3 w-full bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
							>
								{t("Взять этот размер")}</button>
						</div>
					)}
					{measured.trim() !== '' && !measuredValid && (
						<p className="mt-2 text-xs text-red-500">
							{t("Введите число от 40 до 80 мм.")}</p>
					)}
				</div>
			)}

			<div className="border-t border-zinc-200 pt-4 text-sm text-zinc-500">
				<p>
					{t("Выбрано: ")}<span className="text-zinc-900">⌀ {fmt(ringSize)} {t("мм")}</span>
				</p>
				<p className="mt-0.5 text-zinc-400">
					{t("Окружность ")}{fmt(ringCircumference(ringSize))} {t("мм")}</p>
			</div>
		</div>
	)
}
