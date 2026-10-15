'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { PREFERENCES_KEY, usePreferences, type Language, type Theme } from '@/lib/preferences'
import { GUIDE_PATH, RU_GUIDE_PATH, PAGE_COPY } from '@/lib/seo'

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const language = usePreferences(s => s.language)
	const pathname = usePathname()
	useEffect(() => {
		// Guides have stable, server-rendered language URLs and their own metadata.
		// Never replace their language/title with a browser preference.
		if (pathname === GUIDE_PATH || pathname === RU_GUIDE_PATH) {
			document.documentElement.lang = pathname === RU_GUIDE_PATH ? 'ru' : 'en'
			return
		}
		document.documentElement.lang = language
		const english = language === 'en'
		const copy = PAGE_COPY[pathname as keyof typeof PAGE_COPY]?.[language]
		if (!copy && !['/admin', '/create-mapbox', '/create-terrarium'].includes(pathname)) return
		const title = copy ? copy[0]
			: pathname === '/create-mapbox' ? (english ? 'Mapbox — Mesto Metal' : 'Mapbox — Место Металл')
			: pathname === '/create-terrarium' ? (english ? 'Terrarium — Mesto Metal' : 'Terrarium — Место Металл')
			: pathname === '/admin' ? (english ? 'Admin sign-in — Mesto Metal' : 'Служебный вход — Место Металл')
			: english ? 'Mesto Metal — A ring with the landscape of your favourite place' : 'Место Металл — Кольцо с рельефом любимого места'
		const syncTitle = () => {
			// React 19/Next can stream the title into the body before hoisting it.
			// Setting document.title at that point creates a second title in head.
			for (const element of document.querySelectorAll('title')) {
				if (element.textContent !== title) element.textContent = title
			}
		}
		syncTitle()
		const observer = new MutationObserver(records => {
			if (records.some(record => (record.target instanceof Element && record.target.closest('title'))
				|| record.target.parentElement?.closest('title')
				|| Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches('title') || node.querySelector('title'))))) syncTitle()
		})
		observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
		return () => observer.disconnect()
	}, [language, pathname])
	useEffect(() => {
		const restore = () => {
			let language: Language = 'en', theme: Theme = 'dark'
			try {
				const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
				if (value?.language === 'ru' || value?.language === 'en') language = value.language
				if (value?.theme === 'light' || value?.theme === 'dark') theme = value.theme
			} catch { /* Corrupt or unavailable storage falls back to defaults. */ }
			usePreferences.setState({ language, theme, ready: true })
			const path = window.location.pathname
			document.documentElement.lang = path === RU_GUIDE_PATH ? 'ru' : path === GUIDE_PATH ? 'en' : language
			document.documentElement.dataset.theme = theme
		}
		restore()
		const sync = (event: StorageEvent) => { if (event.key === PREFERENCES_KEY || event.key === null) restore() }
		window.addEventListener('storage', sync)
		return () => window.removeEventListener('storage', sync)
	}, [])
	return children
}
