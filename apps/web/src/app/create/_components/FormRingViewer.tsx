'use client'

import type { RingForm } from '@/store/useAppStore'
import { MountainRingViewer } from './MountainRingViewer'

const MOUNTAIN_RING_CAMERA = {
	position: [-4.35, 3.45, 5.4] as [number, number, number],
	target: [0, 0.2, 0] as [number, number, number],
}

export function FormRingViewer({ className = '' }: { className?: string }) {
	return (
		<MountainRingViewer
			className={className}
			cameraPosition={MOUNTAIN_RING_CAMERA.position}
			cameraTarget={MOUNTAIN_RING_CAMERA.target}
		/>
	)
}

export const RING_FORM_OPTIONS: {
	id: RingForm
	label: string
	hint: string
}[] = [
	{
		id: 'mountain',
		label: 'Горный',
		hint: 'Плато — продолжение обруча',
	},
]
