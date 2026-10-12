'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { PREFERENCES_KEY, usePreferences, type Language, type Theme } from '@/lib/preferences'

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const language = usePreferences(s => s.language)
	const pathname = usePathname()
	useEffect(() => {
		const english = language === 'en'
		const title = pathname === '/credits' ? (english ? 'Authors and assets — Mesto Metal' : 'Авторы и материалы — Место Металл')
			: pathname === '/create-mapbox' ? (english ? 'Mapbox — Mesto Metal' : 'Mapbox — Место Металл')
			: pathname === '/admin' ? (english ? 'Admin sign-in — Mesto Metal' : 'Служебный вход — Место Металл')
			: english ? 'Mesto Metal — A ring with the landscape of your favourite place' : 'Место Металл — Кольцо с рельефом любимого места'
		const syncTitle = () => { if (document.title !== title) document.title = title }
		syncTitle()
		// Next can insert server metadata after the stored language is restored.
		const observer = new MutationObserver(syncTitle)
		observer.observe(document.head, { childList: true, subtree: true, characterData: true })
		return () => observer.disconnect()
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
