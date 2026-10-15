'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { PREFERENCES_KEY, usePreferences, type Language, type Theme } from '@/lib/preferences'
import { isUsdExchangeRate } from '@favplace/shared'

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const language = usePreferences(s => s.language)
	const pathname = usePathname()
	useEffect(() => {
		const abort = new AbortController()
		fetch('/api/currency/usd', { signal: abort.signal })
			.then(response => { if (!response.ok) throw new Error('Currency unavailable'); return response.json() })
			.then(quote => {
				if (!abort.signal.aborted && isUsdExchangeRate(quote)) usePreferences.setState({ rubPerUsd: quote.rubPerUsd })
			})
			.catch(() => { /* Prices retain the verified fallback quote. */ })
		return () => abort.abort()
	}, [])
	useEffect(() => {
		const english = language === 'en'
		const title = pathname === '/credits' ? (english ? 'Authors and assets — Mesto Metal' : 'Авторы и материалы — Место Металл')
			: pathname === '/create-mapbox' ? (english ? 'Mapbox — Mesto Metal' : 'Mapbox — Место Металл')
			: pathname === '/create-terrarium' ? (english ? 'Terrarium — Mesto Metal' : 'Terrarium — Место Металл')
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
			let language: Language = 'en', theme: Theme = 'dark'
			try {
				const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
				if (value?.language === 'ru' || value?.language === 'en') language = value.language
				if (value?.theme === 'light' || value?.theme === 'dark') theme = value.theme
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
