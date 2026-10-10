'use client'

import { useT, usePreferences, type Language } from '@/lib/preferences'

import { useAppStore } from '@/store/useAppStore'
import { useState } from 'react'
import { TerrainMap, ringFormToFrameShape, type FlyTarget } from '../TerrainMap'
import { FieldLabel, Hint, StepHeading } from '../ui'

const SCALE_OPTIONS = [
	{ value: 100, label: '100 м' },
	{ value: 500, label: '500 м' },
	{ value: 2000, label: '2 км' },
	{ value: 5000, label: '5 км' },
	{ value: 10000, label: '10 км' },
]

const PRESETS = [
	{ name: 'Эльбрус', lat: 43.3499, lng: 42.4453 },
	{ name: 'Домбай', lat: 43.2889, lng: 41.6244 },
	{ name: 'Красная Поляна', lat: 43.6795, lng: 40.2075 },
	{ name: 'Белуха', lat: 49.8073, lng: 86.5895 },
	{ name: 'Фудзи', lat: 35.3628, lng: 138.7307 },
	{ name: 'Ай-Петри', lat: 44.4515, lng: 34.0561 },
]

interface SearchResult {
	name: string
	display_name: string
	lat: number
	lon: number
	country?: string
}

async function searchNominatim(query: string, language: Language): Promise<SearchResult[]> {
	const res = await fetch(
		`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=6&accept-language=${language}`,
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

async function searchEsri(query: string, language: Language): Promise<SearchResult[]> {
	const res = await fetch(
		`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?singleLine=${encodeURIComponent(query)}&maxLocations=6&f=json&langCode=${language}&outFields=PlaceName,Place_addr,City,Region,Country`,
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

export function StepPlace({
	flyTarget,
	flyTo,
	fetching,
}: {
	flyTarget: FlyTarget
	flyTo: (lat: number, lng: number) => void
	fetching: boolean
}) {
	const t = useT()
	const language = usePreferences(s => s.language)
	const {
		ringForm,
		location,
		setLocation,
		setCoordinates,
		radius,
		setRadius,
		setInteracting,
		terrainBearing,
		setTerrainBearing,
		heightMap,
		elevationMeta,
		edgeLocation,
		setEdgeLocation,
		setEdgeCoordinates,
		edgeRadius,
		setEdgeRadius,
		edgeStart,
		setEdgeStart,
	} = useAppStore()

	// Вторая карта формы «duo» живёт своим прицелом: он не должен сбивать
	// основную при выборе пресета.
	const [edgeTarget, setEdgeTarget] = useState<FlyTarget>({
		lat: 43.3499,
		lng: 42.4453,
		key: 0,
	})
	/** Пресет: запомнить место и увести карту к нему. */
	const pickEdge = (name: string, lat: number, lng: number) => {
		setEdgeLocation({
			id: crypto.randomUUID(),
			name,
			country: '',
			coordinates: { lat, lng },
		})
		setEdgeTarget(prev => ({ lat, lng, key: prev.key + 1 }))
	}



	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)

	const handleSearch = async () => {
		if (!query.trim()) return
		setSearching(true)
		try {
			let found: SearchResult[] = []
			try {
				found = await searchNominatim(query, language)
			} catch {
				/* fallback */
			}
			if (found.length === 0) {
				try {
					found = await searchEsri(query, language)
				} catch {
					/* ignore */
				}
			}
			setResults(found)
		} finally {
			setSearching(false)
		}
	}

	const pick = (name: string, lat: number, lng: number, country = '') => {
		setLocation({
			id: crypto.randomUUID(),
			name,
			country,
			coordinates: { lat, lng },
		})
		setResults([])
		setQuery(name)
		flyTo(lat, lng)
	}

	return (
		<div>
			<StepHeading
				title={t("Найдите своё место")}
				hint={t("Двигайте карту: участок в рамке станет рельефом вашего кольца.")}
			/>

			<div className="space-y-3">
				<div className="flex gap-2">
					<input
						aria-label={t("Поиск места")}
						type="search"
						enterKeyHint="search"
						value={query}
						onChange={e => setQuery(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && handleSearch()}
						placeholder={t("Гора, город, место…")}
						className="min-h-11 min-w-0 flex-1 border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none lg:text-sm"
					/>
					<button
						type="button"
						onClick={handleSearch}
						disabled={searching}
						className="shrink-0 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
					>
						{searching ? '…' : t('Найти')}
					</button>
				</div>

				{results.length > 0 && (
					<ul className="max-h-36 overflow-y-auto border border-zinc-200">
						{results.map((r, i) => (
							<li key={i}>
								<button
									type="button"
									onClick={() => pick(r.name, r.lat, r.lon, r.country)}
									className="w-full px-3 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
								>
									{r.display_name}
								</button>
							</li>
						))}
					</ul>
				)}


				<p className="hidden text-xs leading-relaxed text-zinc-500 [@media(pointer:coarse)]:block">
					{t("Двигайте карту двумя пальцами. Одним пальцем прокручивайте настройки.")}</p>
				<div className="relative h-72 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 lg:h-[360px]">
					<TerrainMap
						target={flyTarget}
						radius={radius}
						frameShape={ringFormToFrameShape(ringForm)}
						bearing={terrainBearing}
						onCenterChange={(lng, lat) => setCoordinates(lat, lng)}
						onRadiusChange={setRadius}
						onInteractingChange={setInteracting}
					/>
				</div>

				<div className="flex flex-wrap gap-1.5">
					{PRESETS.map(p => (
						<button
							key={t(p.name)}
							type="button"
							onClick={() => pick(p.name, p.lat, p.lng)}
							className="min-h-11 border border-zinc-200 px-3 py-2 text-xs text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-800"
						>
							{t(p.name)}
						</button>
					))}
				</div>


				{ringForm === 'duo' && (
					<div className="space-y-3 border-t border-zinc-200 pt-5">
						<div>
							<FieldLabel>{t("Вторая местность — по краям площадки")}</FieldLabel>
							<Hint>
								{t("Ложится двумя полосами со стороны скосов. Высоты нормируются отдельно, поэтому равнина рядом с горой не потеряет рельеф.")}</Hint>
						</div>

						<div className="flex flex-wrap gap-1.5">
							{PRESETS.map(p => (
								<button
									key={`edge-${t(p.name)}`}
									type="button"
									onClick={() => pickEdge(p.name, p.lat, p.lng)}
									className={`border px-2.5 py-1 text-xs transition ${
										edgeLocation?.name === p.name
											? 'border-zinc-900 bg-zinc-900 text-white'
											: 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
									}`}
								>
									{t(p.name)}
								</button>
							))}
						</div>

						<div className="relative h-56 overflow-hidden border border-zinc-200 bg-zinc-100">
							<TerrainMap
								target={edgeTarget}
								radius={edgeRadius}
								frameShape={ringFormToFrameShape(ringForm)}
								onCenterChange={(lng, lat) => setEdgeCoordinates(lat, lng)}
								onRadiusChange={setEdgeRadius}
							/>
						</div>

						<div>
							<FieldLabel aside={`${Math.round(edgeStart * 100)}%`}>
								{t("Доля основной местности")}</FieldLabel>
							<input
								type="range"
								min={0.2}
								max={0.95}
								step={0.01}
								value={edgeStart}
								onChange={e => setEdgeStart(parseFloat(e.target.value))}
								className="mt-2 w-full accent-zinc-900"
							/>
							<Hint>{t("Сколько ширины площадки занимает центральное место.")}</Hint>
						</div>
					</div>
				)}

				<div>
					<FieldLabel aside={`${Math.round(terrainBearing)}°`}>
						{t("Поворот рамки")}</FieldLabel>
					<input
						type="range"
						min={-180}
						max={180}
						step={1}
						value={terrainBearing}
						onChange={e => setTerrainBearing(parseFloat(e.target.value))}
						className="mt-3 w-full"
						aria-label={t("Поворот рамки")}
					/>
					<Hint>{t("Разворачивает выбранный участок — гребень можно поставить вдоль кольца.")}</Hint>
				</div>

				<div className="flex flex-wrap gap-1">
					{SCALE_OPTIONS.map(opt => (
						<button
							key={opt.value}
							type="button"
							onClick={() => setRadius(opt.value)}
							aria-pressed={radius === opt.value}
							className={`min-h-11 px-3 py-2 text-xs font-medium transition ${
								radius === opt.value
									? 'bg-zinc-900 text-white'
									: 'text-zinc-500 hover:bg-zinc-100'
							}`}
						>
							{t(opt.label)}
						</button>
					))}
				</div>

				{location && (
					<p className="text-xs text-zinc-500">
						{t(location.name)}{' '}
						<span className="text-zinc-400">
							{location.coordinates.lat.toFixed(4)}° ·{' '}
							{location.coordinates.lng.toFixed(4)}°
						</span>
					</p>
				)}

				{fetching ? (
					<p className="flex items-center gap-2 text-xs text-zinc-500">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900" />
						{t("Считаем рельеф…")}</p>
				) : (
					elevationMeta &&
					heightMap && (
						<p className="text-xs text-zinc-400">
							{t("Перепад высот: ")}{Math.round(elevationMeta.max - elevationMeta.min)} {t("м (")}{Math.round(elevationMeta.min)}–{Math.round(elevationMeta.max)} {t("м)")}</p>
					)
				)}
			</div>
		</div>
	)
}
