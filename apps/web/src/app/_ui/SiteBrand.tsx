'use client'

import { usePreferences } from '@/lib/preferences'

export function SiteBrand() {
	const english = usePreferences(s => s.language) === 'en'
	return <span className="inline-flex flex-col leading-[.85] sm:flex-row sm:gap-[.2em] sm:leading-none"><span>{english ? 'Mesto' : 'Место'}</span>{' '}<span>{english ? 'Metal' : 'Металл'}</span></span>
}
