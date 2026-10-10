'use client'

import { useCallback } from 'react'
import { create } from 'zustand'
import { EN, EN_VARIABLE_MESSAGES } from './translations'

export type Language = 'ru' | 'en'
export type Theme = 'light' | 'dark'
export const PREFERENCES_KEY = 'favplace:preferences'
export const CANVAS_BACKGROUNDS = { light: '#f4f4f5', dark: '#141418' } as const

interface Preferences {
	ready: boolean
	language: Language
	theme: Theme
	setLanguage: (language: Language) => void
	setTheme: (theme: Theme) => void
}

function apply(language: Language, theme: Theme) {
	document.documentElement.lang = language
	document.documentElement.dataset.theme = theme
	try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ language, theme })) } catch { /* In-memory choices still work. */ }
}

export const usePreferences = create<Preferences>((set, get) => ({
	ready: false,
	language: 'ru',
	theme: 'light',
	setLanguage(language) { set({ language }); apply(language, get().theme) },
	setTheme(theme) { set({ theme }); apply(get().language, theme) },
}))

export function translate(text: string, language: Language): string {
	if (language === 'ru') return text
	const key = text.trim()
	if (EN[key]) return text.replace(key, EN[key])
	for (const [pattern, render] of EN_VARIABLE_MESSAGES) {
		const match = key.match(pattern)
		if (match) return render(match)
	}
	return text
}

export function useT() {
	const language = usePreferences(s => s.language)
	return useCallback((text: string) => translate(text, language), [language])
}

export function usePriceFormatter() {
	const language = usePreferences(s => s.language)
	return useCallback((amount: number) => `${Math.round(amount).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')} ₽`, [language])
}

export function useNumberFormatter() {
	const language = usePreferences(s => s.language)
	return useCallback((amount: number, digits = 1) => amount.toLocaleString(language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: digits }), [language])
}
