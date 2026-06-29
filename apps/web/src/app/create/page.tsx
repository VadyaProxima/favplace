'use client'

import { useAppStore } from '@/store/useAppStore'
import { AnimatePresence, motion } from 'motion/react'
import { EngravingStep } from './_components/EngravingStep'
import { LocationStep } from './_components/LocationStep'
import { MaterialStep } from './_components/MaterialStep'
import { PreviewStep } from './_components/PreviewStep'
import { ScaleStep } from './_components/ScaleStep'
import { StepNavigator } from './_components/StepNavigator'
import { SummaryStep } from './_components/SummaryStep'

const STEP_COMPONENTS = {
	location: LocationStep,
	scale: ScaleStep,
	preview: PreviewStep,
	material: MaterialStep,
	engraving: EngravingStep,
	summary: SummaryStep,
} as const

const STEP_ORDER = [
	'location',
	'scale',
	'preview',
	'material',
	'engraving',
	'summary',
] as const

const variants = {
	enter: (direction: number) => ({
		x: direction > 0 ? 60 : -60,
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
	},
	exit: (direction: number) => ({
		x: direction < 0 ? 60 : -60,
		opacity: 0,
	}),
}

export default function CreatePage() {
	const step = useAppStore(s => s.step)
	const StepComponent = STEP_COMPONENTS[step]
	const direction = 1

	return (
		<div className="flex min-h-screen flex-col">
			<StepNavigator />
			<div className="flex-1 overflow-hidden">
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={step}
						custom={direction}
						variants={variants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{ duration: 0.3, ease: 'easeInOut' }}
					>
						<StepComponent />
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
