'use client'

import { usePreferences, useT } from '@/lib/preferences'
import styles from './HeaderPreferences.module.css'

export function HeaderPreferences() {
	const { language, theme, setLanguage, setTheme, ready } = usePreferences()
	const t = useT()
	return <div className={styles.controls}>
		<button type="button" disabled={!ready} onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
			className={styles.button} lang={language} aria-label={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
			title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>
			<span>{language.toUpperCase()}</span>
		</button>
		<button type="button" disabled={!ready} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
			className={styles.button} aria-label={t(theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему')}
			title={t(theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему')} aria-pressed={theme === 'dark'}>
			{theme === 'light'
				? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20.5 13.7A8.5 8.5 0 0 1 10.3 3.5a8.5 8.5 0 1 0 10.2 10.2Z" /></svg>
				: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></svg>}
		</button>
	</div>
}
