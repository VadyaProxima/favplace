'use client'

import { useT, usePriceFormatter, useNumberFormatter } from '@/lib/preferences'

import { useAppStore } from '@/store/useAppStore'
import {
	MATERIALS,
	RING_PRODUCTION_DEFAULTS,
	RELIEF_DETAIL_LABELS,
	calcPrice,
	CHECKOUT_LIMITS,
	normalizeCheckoutCustomer,
	validateCheckoutCustomer,
	type CheckoutErrors,
	type CheckoutField,
	type CheckoutRequest,
	type CheckoutResponse,
} from '@favplace/shared'
import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'
import { RING_FORM_OPTIONS } from '../FormRingViewer'
import { buildShareUrl } from '../useConfigUrl'
import { StepHeading, TextField } from '../ui'
import { PhoneField } from '../PhoneField'

const STAGES = [
	{
		n: '01',
		title: 'Заявка',
		text: 'Мы проверяем конфигурацию и связываемся с вами, чтобы подтвердить заказ и способ оплаты.',
	},
	{
		n: '02',
		title: 'Отливка и полировка',
		text: 'Каждое изделие льётся отдельно, рельеф дорабатывается вручную. Обычно 7–14 дней.',
	},
	{
		n: '03',
		title: 'Доставка',
		text: 'СДЭК до вашего пункта выдачи, трек-номер пришлём на почту.',
	},
]

export function StepOrder() {
	const t = useT()
	const formatPrice = usePriceFormatter()
	const fmtSize = useNumberFormatter()
	const state = useAppStore()

	const [values, setValues] = useState({ name: '', phone: '', email: '', comment: '', promo: '' })
	const { name, phone, email, comment, promo } = values
	const [delivery, setDelivery] = useState('')
	const [touched, setTouched] = useState<Partial<Record<CheckoutField, boolean>>>({})
	const errors: CheckoutErrors = validateCheckoutCustomer(values)
	const errorFor = (field: CheckoutField) => touched[field] ? errors[field] : undefined
	const update = (field: CheckoutField, value: string) => {
		setValues(previous => ({ ...previous, [field]: value }))
		setFailed(null)
	}
	const blur = (field: CheckoutField) => {
		if (field === 'name' || field === 'email' || field === 'promo') {
			const normalized = normalizeCheckoutCustomer(values)
			update(field, normalized[field] ?? '')
		}
		setTouched(previous => ({ ...previous, [field]: true }))
	}
	const [submitting, setSubmitting] = useState(false)
	const [failed, setFailed] = useState<string | null>(null)
	const [done, setDone] = useState<CheckoutResponse | null>(null)
	const orderRef = useRef<HTMLFormElement>(null)
	const sendingRef = useRef(false)
	const commentId = useId()

	const formLabel =
		RING_FORM_OPTIONS.find(o => o.id === state.ringForm)?.label ?? state.ringForm

	const price = calcPrice({
		ringForm: state.ringForm,
		material: RING_PRODUCTION_DEFAULTS.material,
		reliefDetail: state.reliefDetail,
		// engraving: state.engraving, // Временно отключена.
		twoTone: RING_PRODUCTION_DEFAULTS.twoTone,
	})

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (sendingRef.current) return
		setTouched({ name: true, phone: true, email: true, promo: true, comment: true })
		if (Object.keys(errors).length > 0) {
			requestAnimationFrame(() => {
				const firstInvalid = orderRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[aria-invalid="true"]')
				firstInvalid?.focus({ preventScroll: true })
				firstInvalid?.scrollIntoView({ block: 'center' })
			})
			return
		}

		sendingRef.current = true
		setSubmitting(true)
		setFailed(null)
		try {
			const payload: CheckoutRequest = {
				config: {
					ringForm: state.ringForm,
					material: RING_PRODUCTION_DEFAULTS.material,
					surfaceFinish: RING_PRODUCTION_DEFAULTS.surfaceFinish,
					reliefDetail: state.reliefDetail,
					reliefHeight: state.reliefHeight,
					twoTone: RING_PRODUCTION_DEFAULTS.twoTone,
					ringSize: state.ringSize,
					// engraving: state.engraving,
					engraving: '', // Временно отключена; сохраняем совместимость формата заявки.
					radius: state.radius,
					location: state.location
						? {
								name: state.location.name,
								country: state.location.country,
								lat: state.location.coordinates.lat,
								lng: state.location.coordinates.lng,
							}
						: null,
					shareUrl: buildShareUrl(),
				},
				customer: normalizeCheckoutCustomer({ ...values, delivery }),
			}

			const res = await fetch('/api/orders/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) {
				const detail = await res.json().catch(() => null)
				throw new Error(detail?.message ?? `${t("Сервер ответил")} ${res.status}`)
			}
			setDone((await res.json()) as CheckoutResponse)
		} catch (err) {
			setFailed(
				err instanceof Error
					? err.message
					: t('Не удалось отправить заявку. Попробуйте ещё раз.'),
			)
		} finally {
			sendingRef.current = false
			setSubmitting(false)
		}
	}

	if (done) {
		return (
			<div className="space-y-6">
				<StepHeading
					title={t("Заявка принята")}
					hint={`${t("Номер")} ${done.number}. ${t("Мы напишем на")} ${email} ${t("и позвоним, чтобы подтвердить заказ.")}`}
				/>
				<div className="border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
					<p>
						{t(formLabel)} · ⌀ {fmtSize(state.ringSize)} {t("мм ·")}{' '}
						{t(MATERIALS[RING_PRODUCTION_DEFAULTS.material].label)}
					</p>
					<p className="mt-1 font-medium text-zinc-900">
						{formatPrice(done.totalPrice)}
					</p>
				</div>
				<div className="space-y-2">
					{STAGES.map(s => (
						<div key={s.n} className="flex gap-3 border-b border-zinc-100 py-3">
							<span className="text-xs tabular-nums text-zinc-300">{s.n}</span>
							<span>
								<span className="block text-sm font-medium text-zinc-800">
									{t(s.title)}
								</span>
								<span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
									{t(s.text)}
								</span>
							</span>
						</div>
					))}
				</div>
				<Link
					href="/"
					className="block border border-zinc-300 py-2.5 text-center text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
				>
					{t("На главную")}</Link>
			</div>
		)
	}

	return (
		<form ref={orderRef} noValidate onSubmit={submit} className="space-y-6">
			<StepHeading title={t("Оформление заказа")} />

			<div className="border border-zinc-200">
				<div className="border-b border-zinc-200 px-4 py-2.5 text-[11px] uppercase tracking-wider text-zinc-400">
					{t("Ваше кольцо")}</div>
				<dl className="divide-y divide-zinc-100 text-sm">
					<Row label={t("Форма")} value={t(formLabel)} />
					<Row
						label={t("Место")}
						value={
							state.location
								? `${t(state.location.name)} · ${state.location.coordinates.lat.toFixed(4)}° N, ${state.location.coordinates.lng.toFixed(4)}° E`
								: t('не выбрано')
						}
					/>
					<Row label={t("Металл")} value={t(MATERIALS[RING_PRODUCTION_DEFAULTS.material].label)} />
					<Row
						label={t("Рельеф")}
						value={`${fmtSize(state.reliefHeight)} ${t("мм")} · ${t(RELIEF_DETAIL_LABELS[state.reliefDetail]).toLowerCase()} ${t("детализация")}`}
					/>
					<Row label={t("Размер")} value={`⌀ ${fmtSize(state.ringSize)} ${t("мм")}`} />
					{/* Гравировка временно отключена.
					{state.engraving.trim() && (
						<Row label="Гравировка" value={`«${state.engraving.trim()}»`} />
					)}
					*/}
				</dl>
			</div>

			<div className="border border-zinc-200">
				<dl className="divide-y divide-zinc-100 text-sm">
					{price.lines.map(line => (
						<Row key={t(line.label)} label={t(line.label)} value={formatPrice(line.amount)} />
					))}
				</dl>
				<div className="flex items-baseline justify-between border-t border-zinc-200 px-4 py-3">
					<span className="text-sm text-zinc-500">{t("Итого")}</span>
					<span className="font-display text-xl font-semibold text-zinc-900">
						{formatPrice(price.total)}
					</span>
				</div>
			</div>

			<p className="text-xs leading-relaxed text-zinc-400">
				{t("Изготовление 7–14 дней, дальше доставка СДЭК до вашего пункта выдачи. Оплата не списывается сейчас — мы свяжемся с вами, чтобы подтвердить заказ.")}</p>

			<div className="space-y-4">
				<TextField
					label={t("Имя")}
					autoComplete="name"
					required
					value={name}
					onChange={value => update('name', value)}
					onBlur={() => blur('name')}
					maxLength={CHECKOUT_LIMITS.name}
					placeholder={t("Как к вам обращаться")}
					error={errorFor('name')}
				/>
				<PhoneField
					value={phone}
					onChange={value => update('phone', value)}
					onBlur={() => blur('phone')}
					error={errorFor('phone')}
				/>
				<p className="!mt-1 text-xs text-zinc-400">{t('Можно указать номер любой страны — начните с + и кода страны.')}</p>
				<TextField
					label="Email"
					required
					type="email"
					autoComplete="email"
					value={email}
					onChange={value => update('email', value)}
					onBlur={() => blur('email')}
					inputMode="email"
					autoCapitalize="none"
					spellCheck={false}
					maxLength={CHECKOUT_LIMITS.email}
					placeholder="you@example.com"
					error={errorFor('email')}
				/>
				<TextField
					label={t("Пункт выдачи СДЭК")}
					value={delivery}
					onChange={setDelivery}
					placeholder={t("Город и адрес ближайшего пункта выдачи")}
				/>

				<label className="block">
					<span className="text-[11px] uppercase tracking-wider text-zinc-400">
						{t("Комментарий")}</span>
					<textarea
						id={commentId}
						value={comment}
						onChange={e => update('comment', e.target.value)}
						onBlur={() => blur('comment')}
						maxLength={CHECKOUT_LIMITS.comment}
						aria-invalid={errorFor('comment') ? true : undefined}
						aria-describedby={`${commentId}-count${errorFor('comment') ? ` ${commentId}-error` : ''}`}
						rows={3}
						placeholder={t("Пожелания к изделию, срокам, упаковке")}
						className="mt-1.5 w-full resize-none border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none lg:text-sm"
					/>
					<span id={`${commentId}-count`} className="mt-1 block text-right text-xs tabular-nums text-zinc-400">{comment.length} / {CHECKOUT_LIMITS.comment}</span>
					{errorFor('comment') && <span id={`${commentId}-error`} className="mt-1 block text-xs text-red-500">{t(errors.comment!)}</span>}
				</label>

				<TextField
					label={t('Промокод')}
					value={promo}
					onChange={value => update('promo', value.toUpperCase())}
					onBlur={() => blur('promo')}
					maxLength={CHECKOUT_LIMITS.promo}
					autoCapitalize="characters"
					spellCheck={false}
					error={errorFor('promo')}
				/>
			</div>

			{failed && (
				<p className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
					{t(failed)}
				</p>
			)}

			<button
				type="submit"
				disabled={submitting}
				className="w-full bg-zinc-900 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-zinc-700 disabled:opacity-40"
			>
				{submitting ? t('Отправляем…') : `${t("Отправить заявку")} · ${formatPrice(price.total)}`}
			</button>

			<div className="space-y-2 border-t border-zinc-200 pt-5">
				{STAGES.map(s => (
					<div key={s.n} className="flex gap-3 py-2">
						<span className="text-xs tabular-nums text-zinc-300">{s.n}</span>
						<span>
							<span className="block text-sm font-medium text-zinc-800">{t(s.title)}</span>
							<span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
								{t(s.text)}
							</span>
						</span>
					</div>
				))}
			</div>

			<p className="pb-2 text-[11px] leading-relaxed text-zinc-400">
				{t("Каждое изделие отливается вручную и по отдельности — готовая вещь может немного отличаться от цифрового превью.")}</p>
		</form>
	)
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
			<dt className="max-w-[50%] text-zinc-400">{label}</dt>
			<dd className="min-w-0 flex-1 break-words text-right text-zinc-800">{value}</dd>
		</div>
	)
}
