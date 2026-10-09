'use client'

import { useAppStore, type ReliefDetail } from '@/store/useAppStore'
import {
	// ENGRAVING_MAX_LENGTH,
	// ENGRAVING_PRICE,
	RELIEF_DETAIL_LABELS,
	// formatPrice,
} from '@favplace/shared'
import { ChoiceButton, FieldLabel, Hint, StepHeading } from '../ui'

export function StepRelief() {
	const {
		reliefHeight,
		reliefScale,
		setReliefScale,
		reliefDetail,
		setReliefDetail,
		// engraving,
		// setEngraving,
		heightMap,
		elevationMeta,
	} = useAppStore()

	return (
		<div className="space-y-8">
			<StepHeading
				title="Рельеф"
				hint="Высота — художественное преувеличение: в реальном масштабе горы почти не читаются на 20 мм площадки."
			/>

			<div>
				<FieldLabel
					aside={`${reliefHeight.toFixed(2)} мм · ${Math.round(reliefScale * 100)}%`}
				>
					Высота рельефа
				</FieldLabel>
				{/*
					Ползунок ведёт нормированный reliefScale, а не миллиметры:
					именно его ждёт геометрия, а диапазон 0,3–3,0 мм задаётся
					в referenceSignetTerrain и не дублируется здесь.
				*/}
				<input
					type="range"
					min={0}
					max={1}
					step={0.01}
					value={reliefScale}
					onChange={e => setReliefScale(parseFloat(e.target.value))}
					className="mt-3 w-full"
					aria-label="Высота рельефа"
				/>
				<div className="mt-1 flex justify-between text-[11px] uppercase tracking-wider text-zinc-400">
					<span>плоский</span>
					<span>высокий</span>
				</div>
				{elevationMeta && heightMap && (
					<Hint>
						Реальный перепад в рамке —{' '}
						{Math.round(elevationMeta.max - elevationMeta.min)} м.
					</Hint>
				)}
			</div>

			<div>
				<FieldLabel>Детализация</FieldLabel>
				<div className="mt-2 grid grid-cols-3 gap-2">
					{(['low', 'medium', 'high'] as ReliefDetail[]).map(d => (
						<ChoiceButton
							key={d}
							selected={reliefDetail === d}
							onClick={() => setReliefDetail(d)}
						>
							{RELIEF_DETAIL_LABELS[d]}
						</ChoiceButton>
					))}
				</div>
				<Hint>Плотность сетки рельефа и объём ручной доводки после литья.</Hint>
			</div>

			{/* Гравировка временно отключена.
			<div>
				<FieldLabel aside={`+${formatPrice(ENGRAVING_PRICE)}`}>
					Гравировка внутри шинки
				</FieldLabel>
				<input
					type="text"
					aria-label="Гравировка внутри шинки"
					value={engraving}
					onChange={e => setEngraving(e.target.value.slice(0, ENGRAVING_MAX_LENGTH))}
					maxLength={ENGRAVING_MAX_LENGTH}
					placeholder="Дата, координаты, имя…"
					className="mt-2 min-h-11 w-full border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none lg:text-sm"
				/>
				<Hint>
					{engraving.length}/{ENGRAVING_MAX_LENGTH} символов. Оставьте пустым, если
					гравировка не нужна.
				</Hint>
			</div>
			*/}
		</div>
	)
}
