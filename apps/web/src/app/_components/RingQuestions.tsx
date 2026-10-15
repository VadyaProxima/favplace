'use client'

import Link from 'next/link'
import { usePreferences } from '@/lib/preferences'
import { ringQuestions } from '@/lib/ringGuide'
import { GUIDE_PATH, RU_GUIDE_PATH } from '@/lib/seo'

export function RingQuestions() {
	const language = usePreferences(s => s.language)
	return <section id="questions" aria-labelledby="questions-title" className="border-t border-zinc-200 px-5 py-14 md:px-8 md:py-20">
		<div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
			<div><h2 id="questions-title" className="font-display text-4xl md:text-5xl">{language === 'en' ? 'Your ring, explained.' : 'О вашем кольце.'}</h2>
				<Link href={language === 'en' ? GUIDE_PATH : RU_GUIDE_PATH} className="mt-6 inline-block underline underline-offset-4">{language === 'en' ? 'Read the design guide' : 'Как выбрать место и настроить кольцо'} ↗</Link></div>
			<div>{ringQuestions(language).map(({ question, answer }) => <details key={question} className="border-b border-zinc-200 py-4 first:pt-0">
				<summary className="cursor-pointer text-base font-medium">{question}</summary><p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">{answer}</p>
			</details>)}</div>
		</div>
	</section>
}
