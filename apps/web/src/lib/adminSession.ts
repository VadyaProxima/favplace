'use client'

import { useEffect, useState } from 'react'

export interface AdminSession {
	/** null — статус ещё не известен, запрос в полёте. */
	isAdmin: boolean | null
	refresh: () => void
}

async function fetchSession(): Promise<boolean> {
	try {
		const res = await fetch('/api/admin/session', { cache: 'no-store' })
		if (!res.ok) return false
		const data = (await res.json()) as { authenticated?: boolean }
		return Boolean(data.authenticated)
	} catch {
		// API недоступен — считаем, что админа нет: кнопка просто не появится.
		return false
	}
}

/**
 * Кука сессии — httpOnly, поэтому из JS её не прочитать: статус спрашиваем
 * у API. Пока ответа нет, возвращаем null, чтобы кнопка не мигала.
 */
export function useAdminSession(): AdminSession {
	const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
	const [nonce, setNonce] = useState(0)

	useEffect(() => {
		let alive = true
		fetchSession().then(ok => {
			if (alive) setIsAdmin(ok)
		})
		return () => {
			alive = false
		}
	}, [nonce])

	return { isAdmin, refresh: () => setNonce(n => n + 1) }
}

export async function adminLogin(password: string): Promise<string | null> {
	try {
		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password }),
		})
		if (res.ok) return null
		const data = (await res.json().catch(() => null)) as { message?: string } | null
		return data?.message ?? 'Не удалось войти'
	} catch {
		return 'API недоступен'
	}
}

export async function adminLogout(): Promise<void> {
	await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
}
