'use client'

import Link from 'next/link'
import { usePreferences, type Language } from '@/lib/preferences'

export function GuideStudioLink({ language, children }: { language: Language; children: React.ReactNode }) {
	return <Link href="/create" className="underline underline-offset-4" onClick={() => usePreferences.getState().setLanguage(language)}>{children}</Link>
}
