'use client'

import { useAppStore } from '@/store/useAppStore'
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

export default function CreatePage() {
	const step = useAppStore(s => s.step)
	const StepComponent = STEP_COMPONENTS[step]

	return (
		<div className="flex min-h-screen flex-col">
			<StepNavigator />
			<div className="flex-1">
				<StepComponent />
			</div>
		</div>
	)
}
