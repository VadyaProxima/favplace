'use client'

import { useAppStore } from '@/store/useAppStore'
import { AnimatePresence, motion } from 'motion/react'
import { EngravingStep } from './_components/EngravingStep'
import { MaterialStep } from './_components/MaterialStep'
import { StepNavigator } from './_components/StepNavigator'
import { StudioStep } from './_components/StudioStep'
import { SummaryStep } from './_components/SummaryStep'

const STEP_COMPONENTS = {
	studio: StudioStep,
	material: MaterialStep,
	engraving: EngravingStep,
	summary: SummaryStep,
} as const

const STEP_ORDER = ['studio', 'material', 'engraving', 'summary'] as const

const variants = {
	enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (direction: number) => ({ x: direction < 0 ? 60 : -60, opacity: 0 }),
}

export default function CreatePage() {
	const step = useAppStore(s => s.step)
	const currentIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number])
	const direction = 1
	const StepComponent = STEP_COMPONENTS[step as keyof typeof STEP_COMPONENTS] ?? StudioStep

	return (
		<div className="flex h-screen flex-col">
			<StepNavigator />
			<div className="relative flex-1 overflow-hidden">
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={step}
						custom={direction}
						variants={variants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{ duration: 0.3, ease: 'easeInOut' }}
						className="absolute inset-0"
					>
						<StepComponent />
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
