'use client'

import type { RingForm } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'
import { BarRingViewer } from './BarRingViewer'
import { BasicRingViewer } from './BasicRingViewer'
import { DiscRingViewer } from './DiscRingViewer'
import { MountainRingViewer } from './MountainRingViewer'
import { RingViewer } from './RingViewer'

/** Default ¾ view matching the product screenshot (relief + hoop interior). */
export const DEFAULT_RING_CAMERA = {
	position: [-2.15, 1.75, 2.65] as [number, number, number],
	target: [0, 0.5, 0] as [number, number, number],
}

export function FormRingViewer({ className = '' }: { className?: string }) {
	const ringForm = useAppStore(s => s.ringForm)
	const cam = DEFAULT_RING_CAMERA

	if (ringForm === 'mountain') {
		return (
			<MountainRingViewer
				className={className}
				cameraPosition={cam.position}
				cameraTarget={cam.target}
			/>
		)
	}
	if (ringForm === 'disc') {
		return (
			<DiscRingViewer
				className={className}
				mode="disc"
				cameraPosition={cam.position}
				cameraTarget={cam.target}
			/>
		)
	}
	if (ringForm === 'plug') {
		return (
			<DiscRingViewer
				className={className}
				mode="plug"
				cameraPosition={cam.position}
				cameraTarget={cam.target}
			/>
		)
	}
	if (ringForm === 'bar') {
		return (
			<BarRingViewer
				className={className}
				cameraPosition={cam.position}
				cameraTarget={cam.target}
			/>
		)
	}
	if (ringForm === 'square' || ringForm === 'circle' || ringForm === 'oval') {
		return (
			<BasicRingViewer
				className={className}
				variant={ringForm}
				cameraPosition={cam.position}
				cameraTarget={cam.target}
			/>
		)
	}
	return (
		<RingViewer
			className={className}
			cameraPosition={cam.position}
			cameraTarget={cam.target}
		/>
	)
}

export const RING_FORM_OPTIONS: {
	id: RingForm
	label: string
	hint: string
}[] = [
	{
		id: 'classic',
		label: 'Классический',
		hint: 'Сигнет с овальной площадкой под карту',
	},
	{
		id: 'mountain',
		label: 'Горный',
		hint: 'Плато — продолжение обруча',
	},
	{
		id: 'disc',
		label: 'Диск',
		hint: 'Обруч и круглая вставка состыкованы жёстко',
	},
	{
		id: 'plug',
		label: 'Цилиндр',
		hint: 'Толще обруч и круглая вставка',
	},
	{
		id: 'bar',
		label: 'Планка',
		hint: 'Прямоугольная вставка на всю ширину обруча',
	},
	{
		id: 'square',
		label: 'Квадрат',
		hint: 'Базовая модель — квадратная площадка',
	},
	{
		id: 'circle',
		label: 'Круг',
		hint: 'Базовая модель — круглая площадка',
	},
	{
		id: 'oval',
		label: 'Овал',
		hint: 'Базовая модель — овальная площадка',
	},
]
