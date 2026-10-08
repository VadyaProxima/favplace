'use client'

import { adminLogin, adminLogout, useAdminSession } from '@/lib/adminSession'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AdminPage() {
	const { isAdmin, refresh } = useAdminSession()
	const router = useRouter()

	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		setBusy(true)
		setError(null)
		const message = await adminLogin(password)
		setBusy(false)
		if (message) {
			setError(message)
			return
		}
		setPassword('')
		refresh()
		router.push('/create')
	}

	const logout = async () => {
		setBusy(true)
		await adminLogout()
		setBusy(false)
		refresh()
	}

	return (
		<main className="flex min-h-screen items-center justify-center px-6">
			<div className="w-full max-w-sm">
				<h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-900">
					Служебный вход
				</h1>
				<p className="mt-1 text-sm leading-relaxed text-zinc-500">
					Открывает кнопку «Скачать STL» в конструкторе.
				</p>

				{isAdmin === null && (
					<p className="mt-8 text-sm text-zinc-400">Проверяем сессию…</p>
				)}

				{isAdmin === true && (
					<div className="mt-8 space-y-4">
						<p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
							Вы вошли. Экспорт STL доступен.
						</p>
						<div className="flex items-center gap-3">
							<Link
								href="/create"
								className="border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
							>
								В конструктор
							</Link>
							<button
								type="button"
								onClick={logout}
								disabled={busy}
								className="border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
							>
								Выйти
							</button>
						</div>
					</div>
				)}

				{isAdmin === false && (
					<form onSubmit={submit} className="mt-8 space-y-4">
						<div>
							<label
								htmlFor="admin-password"
								className="text-[11px] uppercase tracking-wider text-zinc-400"
							>
								Пароль
							</label>
							<input
								id="admin-password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								className="mt-1.5 w-full border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900"
							/>
						</div>

						{error && <p className="text-sm text-red-600">{error}</p>}

						<button
							type="submit"
							disabled={busy || password.length === 0}
							className="w-full border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
						>
							{busy ? 'Проверяем…' : 'Войти'}
						</button>
					</form>
				)}
			</div>
		</main>
	)
}
