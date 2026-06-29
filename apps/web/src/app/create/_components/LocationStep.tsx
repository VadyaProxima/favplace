'use client'

import { useAppStore } from '@/store/useAppStore'
import { useCallback, useState } from 'react'
import { Map } from './Map'

interface SearchResult {
	display_name: string
	lat: string
	lon: string
	address?: { country?: string }
}

interface AiPlaceResult {
	name: string
	country: string
	lat: number
	lng: number
	confidence: number
	description: string
}

export function LocationStep() {
	const { location, setLocation, setStep } = useAppStore()
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [searching, setSearching] = useState(false)
	const [aiLoading, setAiLoading] = useState(false)
	const [aiResult, setAiResult] = useState<AiPlaceResult | null>(null)

	const search = useCallback(async () => {
		if (!query.trim()) return
		setSearching(true)
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
			)
			const data = await res.json()
			setResults(data)
		} finally {
			setSearching(false)
		}
	}, [query])

	const selectResult = (result: SearchResult) => {
		setLocation({
			id: crypto.randomUUID(),
			name: result.display_name.split(',')[0],
			country: result.address?.country ?? '',
			coordinates: { lat: parseFloat(result.lat), lng: parseFloat(result.lon) },
		})
		setResults([])
		setQuery(result.display_name)
	}

	const handleAiCamera = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		setAiLoading(true)
		setAiResult(null)

		const reader = new FileReader()
		reader.onload = async () => {
			const base64 = (reader.result as string).split(',')[1]
			try {
				const res = await fetch('http://localhost:3001/api/ai/identify-place', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ image: base64 }),
				})
				const data = await res.json()
				if (data) setAiResult(data)
			} finally {
				setAiLoading(false)
			}
		}
		reader.readAsDataURL(file)
	}

	const selectAiResult = () => {
		if (!aiResult) return
		setLocation({
			id: crypto.randomUUID(),
			name: aiResult.name,
			country: aiResult.country,
			coordinates: { lat: aiResult.lat, lng: aiResult.lng },
		})
		setAiResult(null)
	}

	return (
		<div className="flex flex-1 flex-col items-center gap-6 px-6 py-10">
			<div className="w-full max-w-xl space-y-4">
				<h2 className="text-center text-3xl font-bold">Выберите место</h2>
				<p className="text-center text-zinc-400">
					Место, которое навсегда останется с вами
				</p>

				<div className="flex gap-2">
					<input
						value={query}
						onChange={e => setQuery(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && search()}
						placeholder="Гора Фудзи, Москва, Байкал..."
						className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
					/>
					<button
						onClick={search}
						disabled={searching}
						className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
					>
						{searching ? '...' : 'Найти'}
					</button>
				</div>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-zinc-800" />
					</div>
					<div className="relative flex justify-center text-xs">
						<span className="bg-zinc-950 px-3 text-zinc-500">
							или загрузите фото
						</span>
					</div>
				</div>

				<label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 p-4 text-sm text-zinc-400 transition hover:border-amber-500 hover:text-amber-400">
					<span>📷</span>
					<span>
						{aiLoading ? 'Анализируем...' : 'AI-камера: загрузить фото горы'}
					</span>
					<input
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleAiCamera}
					/>
				</label>

				{aiResult && (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
						<div className="text-sm text-zinc-400">AI определил место:</div>
						<div className="mt-1 font-semibold">{aiResult.name}</div>
						<div className="text-sm text-zinc-400">{aiResult.country}</div>
						<div className="text-xs text-zinc-500">{aiResult.description}</div>
						<div className="text-xs text-zinc-500">
							Уверенность: {Math.round(aiResult.confidence * 100)}%
						</div>
						<button
							onClick={selectAiResult}
							className="mt-3 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
						>
							Создать кольцо из этого места
						</button>
					</div>
				)}

				{results.length > 0 && (
					<ul className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900">
						{results.map((r, i) => (
							<li key={i}>
								<button
									onClick={() => selectResult(r)}
									className="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
								>
									{r.display_name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>

			{location && (
				<div className="w-full max-w-xl space-y-4">
					<div className="h-80 overflow-hidden rounded-lg border border-zinc-800">
						<Map
							center={[location.coordinates.lng, location.coordinates.lat]}
							zoom={12}
						/>
					</div>

					<div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
						<div className="text-zinc-400">
							{location.name}, {location.country}
						</div>
						<div className="mt-1 font-mono text-xs text-zinc-500">
							{location.coordinates.lat.toFixed(4)}°,{' '}
							{location.coordinates.lng.toFixed(4)}°
						</div>
					</div>

					<button
						onClick={() => setStep('scale')}
						className="w-full rounded-lg bg-amber-500 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400"
					>
						Выбрать масштаб
					</button>
				</div>
			)}
		</div>
	)
}
