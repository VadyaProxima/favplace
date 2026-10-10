'use client'

import type { ReactNode } from 'react'
import { useT } from '@/lib/preferences'

export function StepHeading({
	title,
	hint,
}: {
	title: string
	hint?: string
}) {
	return (
		<div className="mb-6">
			<h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
				{title}
			</h2>
			{hint && <p className="mt-1 text-sm leading-relaxed text-zinc-500">{hint}</p>}
		</div>
	)
}

export function FieldLabel({
	children,
	aside,
}: {
	children: ReactNode
	aside?: ReactNode
}) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<span className="text-[11px] uppercase tracking-wider text-zinc-400">
				{children}
			</span>
			{aside && <span className="shrink-0 text-sm tabular-nums text-zinc-700">{aside}</span>}
		</div>
	)
}

export function Hint({ children }: { children: ReactNode }) {
	return <p className="mt-2 text-xs leading-relaxed text-zinc-400">{children}</p>
}

export function ChoiceButton({
	selected,
	onClick,
	children,
	className = '',
}: {
	selected: boolean
	onClick: () => void
	children: ReactNode
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={selected}
			className={`min-h-11 min-w-0 border px-2 py-2.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
				selected
					? 'border-zinc-900 bg-zinc-50 text-zinc-900'
					: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
			} ${className}`}
		>
			{children}
		</button>
	)
}

export function TextField({
	label,
	value,
	onChange,
	placeholder,
	type = 'text',
	required,
	error,
	maxLength,
	autoComplete,
}: {
	label: string
	value: string
	onChange: (v: string) => void
	placeholder?: string
	type?: 'text' | 'tel' | 'email'
	required?: boolean
	error?: string
	maxLength?: number
	autoComplete?: string
}) {
	const t = useT()
	return (
		<label className="block">
			<span className="text-[11px] uppercase tracking-wider text-zinc-400">
				{label}
				{required && <span className="text-zinc-400"> *</span>}
			</span>
			<input
				type={type}
				value={value}
				onChange={e => onChange(e.target.value)}
				placeholder={placeholder}
				maxLength={maxLength}
				autoComplete={autoComplete}
				aria-required={required || undefined}
				aria-invalid={error ? true : undefined}
				className={`mt-1.5 min-h-11 w-full border bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:outline-none lg:text-sm ${
					error
						? 'border-red-400 focus:border-red-500'
						: 'border-zinc-200 focus:border-zinc-400'
				}`}
			/>
			{error && <span className="mt-1 block text-xs text-red-500">{t(error)}</span>}
		</label>
	)
}
