'use client'

import { useAppStore } from '@/store/useAppStore'
import {
	MATERIALS,
	RELIEF_DETAIL_LABELS,
	calcPrice,
	formatPrice,
	type CheckoutRequest,
	type CheckoutResponse,
} from '@favplace/shared'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { RING_FORM_OPTIONS } from '../FormRingViewer'
import { buildShareUrl } from '../useConfigUrl'
import { StepHeading, TextField } from '../ui'

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

const fmtSize = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '')

type Errors = Partial<Record<'name' | 'phone' | 'email' | 'delivery', string>>

export function StepOrder() {
	const state = useAppStore()

	const [name, setName] = useState('')
	const [phone, setPhone] = useState('')
	const [email, setEmail] = useState('')
	const [delivery, setDelivery] = useState('')
	const [comment, setComment] = useState('')
	const [promo, setPromo] = useState('')

	const [errors, setErrors] = useState<Errors>({})
	const [submitting, setSubmitting] = useState(false)
	const [failed, setFailed] = useState<string | null>(null)
	const [done, setDone] = useState<CheckoutResponse | null>(null)
	const orderRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const firstInvalid = orderRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')
		firstInvalid?.focus({ preventScroll: true })
		firstInvalid?.scrollIntoView({ block: 'center' })
	}, [errors])

	const formLabel =
		RING_FORM_OPTIONS.find(o => o.id === state.ringForm)?.label ?? state.ringForm

	const price = calcPrice({
		ringForm: state.ringForm,
		material: state.material,
		reliefDetail: state.reliefDetail,
		// engraving: state.engraving, // Временно отключена.
		twoTone: state.mountainTwoTone,
	})

	const validate = (): Errors => {
		const e: Errors = {}
		if (name.trim().length < 2) e.name = 'Укажите имя'
		if (phone.replace(/\D/g, '').length < 10) e.phone = 'Укажите телефон'
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Проверьте email'
		if (delivery.trim().length < 4) e.delivery = 'Укажите город и пункт выдачи'
		return e
	}

	const submit = async () => {
		const e = validate()
		setErrors(e)
		if (Object.keys(e).length > 0) return

		setSubmitting(true)
		setFailed(null)
		try {
			const payload: CheckoutRequest = {
				config: {
					ringForm: state.ringForm,
					material: state.material,
					surfaceFinish: state.surfaceFinish,
					reliefDetail: state.reliefDetail,
					reliefHeight: state.reliefHeight,
					twoTone: state.mountainTwoTone,
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
				customer: {
					name: name.trim(),
					phone: phone.trim(),
					email: email.trim(),
					delivery: delivery.trim(),
					comment: comment.trim() || undefined,
					promo: promo.trim() || undefined,
				},
			}

			const res = await fetch('/api/orders/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) {
				const detail = await res.json().catch(() => null)
				throw new Error(detail?.message ?? `Сервер ответил ${res.status}`)
			}
			setDone((await res.json()) as CheckoutResponse)
		} catch (err) {
			setFailed(
				err instanceof Error
					? err.message
					: 'Не удалось отправить заявку. Попробуйте ещё раз.',
			)
		} finally {
			setSubmitting(false)
		}
	}

	if (done) {
		return (
			<div className="space-y-6">
				<StepHeading
					title="Заявка принята"
					hint={`Номер ${done.number}. Мы напишем на ${email} и позвоним, чтобы подтвердить заказ.`}
				/>
				<div className="border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
					<p>
						{formLabel} · ⌀ {fmtSize(state.ringSize)} мм ·{' '}
						{MATERIALS[state.material].label}
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
									{s.title}
								</span>
								<span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
									{s.text}
								</span>
							</span>
						</div>
					))}
				</div>
				<Link
					href="/"
					className="block border border-zinc-300 py-2.5 text-center text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
				>
					На главную
				</Link>
			</div>
		)
	}

	return (
		<div ref={orderRef} className="space-y-6">
			<StepHeading title="Оформление заказа" />

			<div className="border border-zinc-200">
				<div className="border-b border-zinc-200 px-4 py-2.5 text-[11px] uppercase tracking-wider text-zinc-400">
					Ваше кольцо
				</div>
				<dl className="divide-y divide-zinc-100 text-sm">
					<Row label="Форма" value={formLabel} />
					<Row
						label="Место"
						value={
							state.location
								? `${state.location.name} · ${state.location.coordinates.lat.toFixed(4)}° N, ${state.location.coordinates.lng.toFixed(4)}° E`
								: 'не выбрано'
						}
					/>
					<Row label="Металл" value={MATERIALS[state.material].label} />
					<Row
						label="Поверхность"
						value={state.surfaceFinish === 'polished' ? 'Полированная' : 'Матовая'}
					/>
					<Row
						label="Рельеф"
						value={`${state.reliefHeight.toFixed(1).replace('.', ',')} мм · ${RELIEF_DETAIL_LABELS[state.reliefDetail].toLowerCase()} детализация`}
					/>
					<Row label="Размер" value={`⌀ ${fmtSize(state.ringSize)} мм`} />
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
						<Row key={line.label} label={line.label} value={formatPrice(line.amount)} />
					))}
				</dl>
				<div className="flex items-baseline justify-between border-t border-zinc-200 px-4 py-3">
					<span className="text-sm text-zinc-500">Итого</span>
					<span className="font-display text-xl font-semibold text-zinc-900">
						{formatPrice(price.total)}
					</span>
				</div>
			</div>

			<p className="text-xs leading-relaxed text-zinc-400">
				Изготовление 7–14 дней, дальше доставка СДЭК до вашего пункта выдачи. Оплата
				не списывается сейчас — мы свяжемся с вами, чтобы подтвердить заказ.
			</p>

			<div className="space-y-4">
				<TextField
					label="Имя"
					autoComplete="name"
					required
					value={name}
					onChange={setName}
					placeholder="Как к вам обращаться"
					error={errors.name}
				/>
				<TextField
					label="Телефон"
					required
					type="tel"
					autoComplete="tel"
					value={phone}
					onChange={setPhone}
					placeholder="+7 900 000-00-00"
					error={errors.phone}
				/>
				<TextField
					label="Email"
					required
					type="email"
					autoComplete="email"
					value={email}
					onChange={setEmail}
					placeholder="you@example.com"
					error={errors.email}
				/>
				<TextField
					label="Пункт выдачи СДЭК"
					required
					value={delivery}
					onChange={setDelivery}
					placeholder="Город и адрес ближайшего пункта выдачи"
					error={errors.delivery}
				/>

				<label className="block">
					<span className="text-[11px] uppercase tracking-wider text-zinc-400">
						Комментарий
					</span>
					<textarea
						value={comment}
						onChange={e => setComment(e.target.value)}
						rows={3}
						placeholder="Пожелания к изделию, срокам, упаковке"
						className="mt-1.5 w-full resize-none border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-300 focus:border-zinc-400 focus:outline-none lg:text-sm"
					/>
				</label>

				<TextField label="Промокод" value={promo} onChange={setPromo} />
			</div>

			{failed && (
				<p className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
					{failed}
				</p>
			)}

			<button
				type="button"
				onClick={submit}
				disabled={submitting}
				className="w-full bg-zinc-900 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-zinc-700 disabled:opacity-40"
			>
				{submitting ? 'Отправляем…' : `Отправить заявку · ${formatPrice(price.total)}`}
			</button>

			<div className="space-y-2 border-t border-zinc-200 pt-5">
				{STAGES.map(s => (
					<div key={s.n} className="flex gap-3 py-2">
						<span className="text-xs tabular-nums text-zinc-300">{s.n}</span>
						<span>
							<span className="block text-sm font-medium text-zinc-800">{s.title}</span>
							<span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">
								{s.text}
							</span>
						</span>
					</div>
				))}
			</div>

			<p className="pb-2 text-[11px] leading-relaxed text-zinc-400">
				Каждое изделие отливается вручную и по отдельности — готовая вещь может
				немного отличаться от цифрового превью.
			</p>
		</div>
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
