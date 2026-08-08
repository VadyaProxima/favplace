'use client'

import { useAppStore, type ReliefDetail, type RingForm } from '@/store/useAppStore'
import { MATERIALS, type MaterialType, type SurfaceFinish } from '@favplace/shared'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FormRingViewer, RING_FORM_OPTIONS } from './FormRingViewer'
import { TerrainMap, ringFormToFrameShape, type FlyTarget } from './TerrainMap'

type AccordionId = 'form' | 'relief' | 'material'

const SCALE_OPTIONS = [
	{ value: 100, label: '100 м' },
	{ value: 500, label: '500 м' },
	{ value: 2000, label: '2 км' },
	{ value: 5000, label: '5 км' },
	{ value: 10000, label: '10 км' },
]

const MATERIAL_KEYS: MaterialType[] = ['gold', 'silver', 'platinum']

interface SearchResult {
	name: string
	display_name: string
	lat: number
	lon: number
	country?: string
}

async function searchNominatim(query: string): Promise<SearchResult[]> {
	const res = await fetch(
		`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=6&accept-language=ru`,
		{ signal: AbortSignal.timeout(8000) },
	)
	if (!res.ok) throw new Error(`Nominatim ${res.status}`)
	const data = (await res.json()) as Array<{
		name: string
		display_name: string
		lat: string
		lon: string
	}>
	return data.map(d => ({
		name: d.name || d.display_name.split(',')[0],
		display_name: d.display_name,
		lat: parseFloat(d.lat),
		lon: parseFloat(d.lon),
	}))
}

async function searchEsri(query: string): Promise<SearchResult[]> {
	const res = await fetch(
		`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(query)}&maxLocations=6&f=json&langCode=ru&outFields=PlaceName,Place_addr,City,Region,Country`,
		{ signal: AbortSignal.timeout(8000) },
	)
	if (!res.ok) throw new Error(`Esri ${res.status}`)
	const data = await res.json()
	const candidates = (data.candidates ?? []) as Array<{
		address: string
		location: { x: number; y: number }
		attributes?: {
			PlaceName?: string
			Place_addr?: string
			City?: string
			Region?: string
			Country?: string
		}
	}>
	const results: SearchResult[] = []
	const seen = new Set<string>()
	for (const c of candidates) {
		const a = c.attributes ?? {}
		const name = a.PlaceName || c.address
		const parts = [name, a.Place_addr || [a.City, a.Region].filter(Boolean).join(', ')]
			.filter(Boolean)
			.join(' — ')
		const key = `${parts}|${c.location.x.toFixed(3)},${c.location.y.toFixed(3)}`
		if (seen.has(key)) continue
		seen.add(key)
		results.push({
			name,
			display_name: parts,
			lat: c.location.y,
			lon: c.location.x,
			country: a.Country ?? '',
		})
	}
	return results
}

function Accordion({
	id,
	title,
	subtitle,
	open,
	onToggle,
	children,
}: {
	id: AccordionId
	title: string
	subtitle?: string
	open: boolean
	onToggle: (id: AccordionId) => void
	children: ReactNode
}) {
	return (
		<div className="border-b border-zinc-200">
			<button
				type="button"
				onClick={() => onToggle(id)}
				className="flex w-full items-start justify-between gap-4 py-5 text-left"
				aria-expanded={open}
			>
				<span>
					<span className="block font-display text-xl font-semibold tracking-tight text-zinc-900">
						{title}
					</span>
					{subtitle && (
						<span className="mt-0.5 block text-xs text-zinc-400">{subtitle}</span>
					)}
				</span>
				<span
					className={`mt-1 text-zinc-400 transition ${open ? 'rotate-45' : ''}`}
					aria-hidden
				>
					+
				</span>
			</button>
			<div
				className={`grid transition-[grid-template-rows] duration-300 ease-out ${
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
			>
				<div className="overflow-hidden">
					<div className="pb-6">{children}</div>
				</div>
			</div>
		</div>
	)
}

export function CreateStudio() {
	const {
		ringForm,
		setRingForm,
		location,
		setLocation,
		setCoordinates,
		radius,
		setRadius,
		heightMap,
		setHeightMap,
		elevationMeta,
		setElevationMeta,
		material,
		setMaterial,
		surfaceFinish,
		setSurfaceFinish,
		reliefHeight,
		setReliefHeight,
		reliefDetail,
		setReliefDetail,
		mountainTwoTone,
		setMountainTwoTone,
	} = useAppStore()

	const [open, setOpen] = useState<AccordionId>('form')
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [fetching, setFetching] = useState(false)
	const [ordering, setOrdering] = useState(false)

	const [flyTarget, setFlyTarget] = useState<FlyTarget>({
		lng: 138.7307,
		lat: 35.3628,
		key: 0,
	})

	// Deep-link ?form=
	useEffect(() => {
		if (typeof window === 'undefined') return
		const form = new URLSearchParams(window.location.search).get('form')
		if (!form) return
		const ids = RING_FORM_OPTIONS.map(o => o.id)
		if (ids.includes(form as RingForm)) setRingForm(form as RingForm)
	}, [setRingForm])

	const analyzeSeqRef = useRef(0)
	const analyzeAbortRef = useRef<AbortController | null>(null)

	const analyze = useCallback(
		async (lat: number, lng: number, r: number) => {
			const seq = ++analyzeSeqRef.current
			analyzeAbortRef.current?.abort()
			const ac = new AbortController()
			analyzeAbortRef.current = ac
			setFetching(true)
			try {
				const res = await fetch(
					`/api/terrain/heightmap?lat=${lat}&lng=${lng}&radius=${r}&resolution=512`,
					{ signal: ac.signal },
				)
				if (!res.ok) throw new Error(`API ${res.status}`)
				const data = await res.json()
				if (seq !== analyzeSeqRef.current) return
				setHeightMap(data.data)
				setElevationMeta({
					min: data.metadata.minElevation,
					max: data.metadata.maxElevation,
				})
			} catch (err) {
				if ((err as Error)?.name === 'AbortError') return
			} finally {
				if (seq === analyzeSeqRef.current) setFetching(false)
			}
		},
		[setHeightMap, setElevationMeta],
	)

	const handleSearch = async () => {
		if (!query.trim()) return
		setSearching(true)
		try {
			let found: SearchResult[] = []
			try {
				found = await searchNominatim(query)
			} catch {
				/* fallback */
			}
			if (found.length === 0) {
				try {
					found = await searchEsri(query)
				} catch {
					/* ignore */
				}
			}
			setResults(found)
		} finally {
			setSearching(false)
		}
	}

	const pickResult = (r: SearchResult) => {
		setLocation({
			id: crypto.randomUUID(),
			name: r.name,
			country: r.country ?? '',
			coordinates: { lat: r.lat, lng: r.lon },
		})
		setResults([])
		setQuery(r.name)
		setFlyTarget(prev => ({ lng: r.lon, lat: r.lat, key: prev.key + 1 }))
		analyze(r.lat, r.lon, radius)
	}

	const onOrder = async () => {
		setOrdering(true)
		try {
			const formLabel =
				RING_FORM_OPTIONS.find(o => o.id === ringForm)?.label ?? ringForm
			const body = [
				'Здравствуйте! Хочу оформить кольцо Favplace.',
				'',
				`Форма: ${formLabel}`,
				`Металл: ${MATERIALS[material].label}`,
				`Поверхность: ${surfaceFinish === 'polished' ? 'Полированная' : 'Матовая'}`,
				`Высота рельефа: ${reliefHeight.toFixed(1)}`,
				location
					? `Место: ${location.name} (${location.coordinates.lat.toFixed(5)}, ${location.coordinates.lng.toFixed(5)})`
					: 'Место: не выбрано',
			].join('\n')
			window.location.href = `mailto:hello@favplace.ru?subject=${encodeURIComponent('Заказ Favplace')}&body=${encodeURIComponent(body)}`
		} finally {
			setOrdering(false)
		}
	}

	const formMeta = RING_FORM_OPTIONS.find(o => o.id === ringForm)
	const toggle = (id: AccordionId) => setOpen(id)

	return (
		<div className="flex h-[100svh] w-full overflow-hidden bg-zinc-100">
			{/* 65% — ring frame, centered */}
			<section className="relative flex min-w-0 flex-[65] items-center justify-center">
				<div className="absolute inset-0">
					<FormRingViewer className="h-full w-full" />
				</div>

				{fetching && (
					<div className="pointer-events-none absolute left-6 top-6 z-10 flex items-center gap-2 bg-white/90 px-3 py-1.5 text-xs text-zinc-600 backdrop-blur">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900" />
						Рельеф…
					</div>
				)}
			</section>

			{/* 35% — accordions */}
			<aside className="relative z-10 flex min-w-[320px] flex-[35] flex-col border-l border-zinc-200 bg-white">
				<div className="flex items-center justify-between px-6 py-5 md:px-8">
					<Link href="/" className="font-display text-lg font-semibold tracking-tight">
						Favplace
					</Link>
					<span className="text-[11px] uppercase tracking-wider text-zinc-400">
						Конструктор
					</span>
				</div>

				<div className="flex-1 overflow-y-auto px-6 md:px-8">
					{/* 1. Form */}
					<Accordion
						id="form"
						title="Форма кольца"
						subtitle={formMeta?.label}
						open={open === 'form'}
						onToggle={toggle}
					>
						<div className="grid grid-cols-2 gap-2">
							{RING_FORM_OPTIONS.map(opt => (
								<button
									key={opt.id}
									type="button"
									onClick={() => setRingForm(opt.id)}
									className={`border px-3 py-3 text-left text-sm transition ${
										ringForm === opt.id
											? 'border-zinc-900 bg-zinc-50 text-zinc-900'
											: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
									}`}
								>
									<span className="font-medium">{opt.label}</span>
								</button>
							))}
						</div>
						<p className="mt-3 text-xs leading-relaxed text-zinc-400">
							{formMeta?.hint}
						</p>
					</Accordion>

					{/* 2. Relief */}
					<Accordion
						id="relief"
						title="Рельеф"
						subtitle={location?.name ?? 'Выберите место'}
						open={open === 'relief'}
						onToggle={toggle}
					>
						<div className="space-y-3">
							<div className="flex gap-2">
								<input
									value={query}
									onChange={e => setQuery(e.target.value)}
									onKeyDown={e => e.key === 'Enter' && handleSearch()}
									placeholder="Гора, город, место…"
									className="min-w-0 flex-1 border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
								/>
								<button
									type="button"
									onClick={handleSearch}
									disabled={searching}
									className="shrink-0 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
								>
									{searching ? '…' : 'Найти'}
								</button>
							</div>

							{results.length > 0 && (
								<ul className="max-h-36 overflow-y-auto border border-zinc-200">
									{results.map((r, i) => (
										<li key={i}>
											<button
												type="button"
												onClick={() => pickResult(r)}
												className="w-full px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
											>
												{r.display_name}
											</button>
										</li>
									))}
								</ul>
							)}

							<div className="relative h-52 overflow-hidden border border-zinc-200 bg-zinc-100 md:h-64">
								<TerrainMap
									target={flyTarget}
									radius={radius}
									frameShape={ringFormToFrameShape(ringForm)}
									onCenterChange={(lng, lat) => setCoordinates(lat, lng)}
									onRadiusChange={setRadius}
								/>
							</div>

							<div className="flex flex-wrap gap-1">
								{SCALE_OPTIONS.map(opt => (
									<button
										key={opt.value}
										type="button"
										onClick={() => setRadius(opt.value)}
										className={`px-2.5 py-1.5 text-xs font-medium transition ${
											radius === opt.value
												? 'bg-zinc-900 text-white'
												: 'text-zinc-500 hover:bg-zinc-100'
										}`}
									>
										{opt.label}
									</button>
								))}
							</div>

							<button
								type="button"
								onClick={() => {
									if (!location) return
									analyze(
										location.coordinates.lat,
										location.coordinates.lng,
										radius,
									)
								}}
								disabled={!location || fetching}
								className="w-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-30"
							>
								{fetching ? 'Анализируем…' : 'Анализировать рельеф'}
							</button>

							{elevationMeta && heightMap && (
								<p className="text-xs text-zinc-400">
									Высоты: {Math.round(elevationMeta.min)}–
									{Math.round(elevationMeta.max)} м
								</p>
							)}
						</div>
					</Accordion>

					{/* 3. Material + height */}
					<Accordion
						id="material"
						title="Материал"
						subtitle={MATERIALS[material].label}
						open={open === 'material'}
						onToggle={toggle}
					>
						<div className="space-y-6">
							<div>
								<span className="text-xs uppercase tracking-wider text-zinc-400">
									Металл
								</span>
								<div className="mt-2 grid grid-cols-3 gap-2">
									{MATERIAL_KEYS.map(key => {
										const m = MATERIALS[key]
										return (
											<button
												key={key}
												type="button"
												onClick={() => setMaterial(key)}
												className={`flex flex-col items-center gap-2 border p-3 transition ${
													material === key
														? 'border-zinc-900 bg-zinc-50'
														: 'border-zinc-200 hover:border-zinc-400'
												}`}
											>
												<span
													className="h-8 w-8 rounded-full"
													style={{
														background: m.color,
														boxShadow: 'inset 0 -2px 5px rgba(0,0,0,0.2)',
													}}
												/>
												<span className="text-xs font-medium text-zinc-800">
													{m.label}
												</span>
											</button>
										)
									})}
								</div>
							</div>

							<div>
								<span className="text-xs uppercase tracking-wider text-zinc-400">
									Поверхность
								</span>
								<div className="mt-2 grid grid-cols-2 gap-2">
									{(['polished', 'matte'] as SurfaceFinish[]).map(finish => (
										<button
											key={finish}
											type="button"
											onClick={() => setSurfaceFinish(finish)}
											className={`border px-3 py-2.5 text-sm font-medium transition ${
												surfaceFinish === finish
													? 'border-zinc-900 bg-zinc-50 text-zinc-900'
													: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
											}`}
										>
											{finish === 'polished' ? 'Полированная' : 'Матовая'}
										</button>
									))}
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between">
									<span className="text-xs uppercase tracking-wider text-zinc-400">
										Высота рельефа
									</span>
									<span className="text-sm tabular-nums text-zinc-700">
										{reliefHeight.toFixed(1)}
									</span>
								</div>
								<input
									type="range"
									min={0.4}
									max={3}
									step={0.1}
									value={reliefHeight}
									onChange={e => setReliefHeight(parseFloat(e.target.value))}
									className="mt-3 w-full"
								/>
							</div>

							<div>
								<span className="text-xs uppercase tracking-wider text-zinc-400">
									Детализация
								</span>
								<div className="mt-2 grid grid-cols-3 gap-2">
									{(['low', 'medium', 'high'] as ReliefDetail[]).map(d => (
										<button
											key={d}
											type="button"
											onClick={() => setReliefDetail(d)}
											className={`border px-2 py-2 text-sm font-medium transition ${
												reliefDetail === d
													? 'border-zinc-900 bg-zinc-50 text-zinc-900'
													: 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
											}`}
										>
											{d === 'low'
												? 'Низкая'
												: d === 'medium'
													? 'Средняя'
													: 'Высокая'}
										</button>
									))}
								</div>
							</div>

							{(ringForm === 'mountain' ||
								ringForm === 'disc' ||
								ringForm === 'plug' ||
								ringForm === 'bar') && (
								<div>
									<span className="text-xs uppercase tracking-wider text-zinc-400">
										Отделка рельефа
									</span>
									<div className="mt-2 grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={() => setMountainTwoTone(false)}
											className={`border px-3 py-2.5 text-sm font-medium transition ${
												!mountainTwoTone
													? 'border-zinc-900 bg-zinc-50'
													: 'border-zinc-200 text-zinc-500'
											}`}
										>
											Единый металл
										</button>
										<button
											type="button"
											onClick={() => setMountainTwoTone(true)}
											className={`border px-3 py-2.5 text-sm font-medium transition ${
												mountainTwoTone
													? 'border-zinc-900 bg-zinc-50'
													: 'border-zinc-200 text-zinc-500'
											}`}
										>
											Двухцветный
										</button>
									</div>
								</div>
							)}
						</div>
					</Accordion>
				</div>

				<div className="border-t border-zinc-200 p-6 md:px-8">
					<button
						type="button"
						onClick={onOrder}
						disabled={ordering}
						className="w-full bg-zinc-900 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-zinc-700 disabled:opacity-40"
					>
						Оформить заказ
					</button>
					<p className="mt-2 text-center text-[11px] text-zinc-400">
						Откроется письмо с параметрами заказа
					</p>
				</div>
			</aside>
		</div>
	)
}
