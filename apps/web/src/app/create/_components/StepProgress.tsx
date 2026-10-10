'use client'

import { useAppStore } from '@/store/useAppStore'
import { STUDIO_SECTIONS } from './studioSections'
import styles from './CreateStudio.module.css'

/** Three chapters; individual parameters are tabs within the current chapter. */
export function StepProgress() {
	const step = useAppStore(s => s.step)
	const setStep = useAppStore(s => s.setStep)
	const current = STUDIO_SECTIONS.findIndex(section => section.steps.includes(step))
	return (
		<nav aria-label="Разделы конструктора" className={styles.chapters}>
			{STUDIO_SECTIONS.map((section, index) => (
				<button key={section.title} type="button" onClick={() => setStep(section.steps[0])} aria-current={index === current ? 'step' : undefined}>
					<span className={styles.chapterNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
					<span><strong>{section.title}</strong><span className={styles.chapterDescription}>{section.description}</span></span>
				</button>
			))}
		</nav>
	)
}
