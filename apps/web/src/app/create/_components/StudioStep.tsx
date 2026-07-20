'use client'

import { useAppStore } from '@/store/useAppStore'
import { useRef, useState } from 'react'
import { RingViewer } from './RingViewer'
import { TerrainMap, type FlyTarget } from './TerrainMap'

interface SearchResult {
	name: string
	display_name: string
	lat: number
	lon: number
	country?: string
}

const SCALE_OPTIONS = [
	{ value: 100, label: '100 м' },
	{ value: 500, label: '500 м' },
	{ value: 2000, label: '2 км' },
	{ value: 5000, label: '5 км' },
	{ value: 10000, label: '10 км' },
]

/** Nominatim (OSM) — точный мультиязычный поиск мест; Esri как фолбэк. */
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

export function StudioStep() {
	const {
		location,
		setLocation,
		setCoordinates,
		radius,
		setRadius,
		heightMap,
		setHeightMap,
		elevationMeta,
		setElevationMeta,
		setStep,
	} = useAppStore()

	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [fetching, setFetching] = useState(false)

	// Меняется только при выборе результата поиска — карта летит туда и ставит
	// фрейм. Перетаскивание фрейма карту не дёргает (нет обратного цикла).
	const [flyTarget, setFlyTarget] = useState<FlyTarget>({
		lng: 138.7307,
		lat: 35.3628,
		key: 0,
	})

	// Relief is built on demand (the "Анализировать" button) — NOT in real time.
	// Moving the frame / changing scale only updates the displayed coordinates.
	//
	// Repeated move→analyze cycles can fire overlapping requests (e.g. a slow
	// request from an earlier click resolving after a faster later one); a
	// sequence guard ensures only the response from the LATEST analyze() call
	// is ever applied, so quick back-to-back analyses can't be overwritten by
	// a stale one landing out of order ("works every other time").
	const analyzeSeqRef = useRef(0)
	const analyze = async (lat: number, lng: number, r: number) => {
		const seq = ++analyzeSeqRef.current
		setFetching(true)
		try {
			const res = await fetch(
				`/api/terrain/heightmap?lat=${lat}&lng=${lng}&radius=${r}&resolution=140`,
			)
			if (!res.ok) throw new Error(`API ${res.status}`)
			const data = await res.json()
			if (seq !== analyzeSeqRef.current) return // superseded by a newer analyze
			setHeightMap(data.data)
			setElevationMeta({
				min: data.metadata.minElevation,
				max: data.metadata.maxElevation,
			})
		} catch {
			// keep previous relief on failure
		} finally {
			if (seq === analyzeSeqRef.current) setFetching(false)
		}
	}

	const handleSearch = async () => {
		if (!query.trim()) return
		setSearching(true)
		try {
			let found: SearchResult[] = []
			try {
				found = await searchNominatim(query)
			} catch {
				// сеть/блокировка — пробуем Esri ниже
			}
			if (found.length === 0) {
				try {
					found = await searchEsri(query)
				} catch {}
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

	// перемещение фрейма — только фиксируем координаты, без запроса рельефа
	const onFrameChange = (lng: number, lat: number) => {
		setCoordinates(lat, lng)
	}

	const onAnalyzeClick = () => {
		if (!location) return
		analyze(location.coordinates.lat, location.coordinates.lng, radius)
	}

	return (
		<div className="flex h-full flex-col lg:flex-row">
			{/* left: map + controls */}
			<div className="flex shrink-0 flex-col border-b border-zinc-200 bg-white lg:w-[44%] lg:border-b-0 lg:border-r">
				<div className="flex items-center gap-2 border-b border-zinc-200 p-3">
					<input
						value={query}
						onChange={e => setQuery(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && handleSearch()}
						placeholder="Гора, город, место…"
						className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
					/>
					<button
						onClick={handleSearch}
						disabled={searching}
						className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
					>
						{searching ? '…' : 'Найти'}
					</button>
				</div>

				{results.length > 0 && (
					<ul className="border-b border-zinc-200 bg-white">
						{results.map((r, i) => (
							<li key={i}>
								<button
									onClick={() => pickResult(r)}
									className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100"
								>
									{r.display_name}
								</button>
							</li>
						))}
					</ul>
				)}

				<div className="relative min-h-[320px] flex-1">
					<TerrainMap
						target={flyTarget}
						radius={radius}
						onCenterChange={onFrameChange}
						onRadiusChange={setRadius}
					/>
				</div>

				<div className="flex items-center gap-3 border-t border-zinc-200 p-3">
					<div className="flex min-w-0 flex-1 items-center gap-1">
						<span className="mr-1 shrink-0 text-xs uppercase tracking-wider text-zinc-400">
							Площадь
						</span>
						{SCALE_OPTIONS.map(opt => (
							<button
								key={opt.value}
								onClick={() => setRadius(opt.value)}
								className={`flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition ${
									radius === opt.value
										? 'bg-zinc-900 text-white'
										: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
								}`}
							>
								{opt.label}
							</button>
						))}
						<span className="ml-1 shrink-0 font-mono text-[11px] text-zinc-400">
							{radius >= 1000 ? `${(radius / 1000).toFixed(1)} км` : `${radius} м`}
						</span>
					</div>
				</div>
			</div>

			{/* right: canvas */}
			<div className="relative flex flex-1 flex-col bg-zinc-100">
				<div className="relative flex-1">
					<RingViewer className="h-full w-full" />

					{fetching && (
						<div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs text-zinc-700 shadow-sm backdrop-blur">
							<span className="h-2 w-2 animate-pulse rounded-full bg-zinc-900" />
							Анализируем рельеф…
						</div>
					)}
				</div>

				<div className="flex items-center justify-between gap-4 border-t border-zinc-200 bg-white px-5 py-3">
					<div className="min-w-0">
						<div className="truncate text-sm font-medium text-zinc-900">
							{location ? location.name : 'Выберите место на карте'}
						</div>
						<div className="truncate font-mono text-[11px] text-zinc-500">
							{location
								? `${location.coordinates.lat.toFixed(5)}°, ${location.coordinates.lng.toFixed(5)}°`
								: '—'}
							{elevationMeta && heightMap
								? ` · ${Math.round(elevationMeta.min)}–${Math.round(elevationMeta.max)} м`
								: ''}
						</div>
					</div>
					<div className="flex shrink-0 gap-2">
						<button
							onClick={onAnalyzeClick}
							disabled={!location || fetching}
							className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-30"
						>
							Анализировать
						</button>
						<button
							onClick={() => setStep('material')}
							disabled={!heightMap}
							className="rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-30"
						>
							Далее →
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
