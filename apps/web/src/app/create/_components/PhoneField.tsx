'use client'

import { formatCheckoutPhone } from '@favplace/shared'
import { useLayoutEffect, useRef } from 'react'
import { useT } from '@/lib/preferences'
import { TextField } from './ui'

/** Keep the caret next to the same digit when separators are inserted. */
function caretAfterDigits(value: string, count: number): number {
  if (count === 0) return value.startsWith('+') ? 1 : 0
  let seen = 0
  for (let index = 0; index < value.length; index++) {
    if (/\d/.test(value[index]) && ++seen === count) return index + 1
  }
  return value.length
}

export function PhoneField({ value, onChange, onBlur, error }: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
}) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (pendingCaret.current === null || document.activeElement !== inputRef.current) return
    inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  })

  return <TextField
    label={t('Телефон')}
    required
    type="tel"
    inputMode="tel"
    autoComplete="tel"
    inputRef={inputRef}
    value={value}
    placeholder="+7 (900) 000-00-00"
    error={error}
    onBlur={onBlur}
    onChange={(raw, event) => {
      const caret = event.target.selectionStart ?? raw.length
      const count = raw.slice(0, caret).replace(/\D/g, '').length
      const formatted = formatCheckoutPhone(raw)
      // Normalizing a pasted local number may insert a country-code digit.
      const added = formatted.replace(/\D/g, '').length - raw.replace(/\D/g, '').length
      pendingCaret.current = caretAfterDigits(formatted, Math.max(0, count + added))
      onChange(formatted)
    }}
    onKeyDown={event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const input = event.currentTarget
      const start = input.selectionStart ?? 0
      const end = input.selectionEnd ?? start
      if (start !== end) return // Native selection deletion is formatted by onChange.
      const backwards = event.key === 'Backspace'
      let target = backwards ? start - 1 : start
      while (target >= 0 && target < value.length && !/\d/.test(value[target])) target += backwards ? -1 : 1
      if (target < 0 || target >= value.length) return
      event.preventDefault()
      const digits = value.replace(/\D/g, '')
      const index = value.slice(0, target).replace(/\D/g, '').length
      const remaining = digits.slice(0, index) + digits.slice(index + 1)
      const formatted = remaining ? formatCheckoutPhone('+' + remaining) : ''
      const before = value.slice(0, start).replace(/\D/g, '').length - (backwards ? 1 : 0)
      pendingCaret.current = caretAfterDigits(formatted, Math.max(0, before))
      onChange(formatted)
    }}
  />
}
