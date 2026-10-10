'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { PREFERENCES_KEY, usePreferences, type Language, type Theme } from '@/lib/preferences'

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const language = usePreferences(s => s.language)
	const pathname = usePathname()
	useEffect(() => {
		const english = language === 'en'
		document.title = pathname === '/credits' ? (english ? 'Credits — Favplace' : 'Использованные материалы — Favplace')
			: pathname === '/admin' ? (english ? 'Admin sign-in — Favplace' : 'Служебный вход — Favplace')
			: english ? 'Favplace — A ring with the landscape of your favourite place' : 'Favplace — Кольцо с рельефом любимого места'
	}, [language, pathname])
	useEffect(() => {
		const restore = () => {
			let language: Language = 'ru', theme: Theme = 'light'
			try {
				const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
				if (value?.language === 'en') language = 'en'
				if (value?.theme === 'dark') theme = 'dark'
			} catch { /* Corrupt or unavailable storage falls back to defaults. */ }
			usePreferences.setState({ language, theme, ready: true })
			document.documentElement.lang = language
			document.documentElement.dataset.theme = theme
		}
		restore()
		const sync = (event: StorageEvent) => { if (event.key === PREFERENCES_KEY || event.key === null) restore() }
		window.addEventListener('storage', sync)
		return () => window.removeEventListener('storage', sync)
	}, [])
	return children
}
