'use client'

import { useAppStore } from '@/store/useAppStore'
import { useEffect, useState } from 'react'
import { RingViewer } from './RingViewer'

export function PreviewStep() {
	const {
		location,
		radius,
		heightMap,
		setHeightMap,
		setElevationMeta,
		setStep,
	} = useAppStore()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!location || heightMap) return
		setLoading(true)
		setError(null)

		fetch(
			`/api/terrain/heightmap?lat=${location.coordinates.lat}&lng=${location.coordinates.lng}&radius=${radius}&resolution=128`,
		)
			.then(r => {
				if (!r.ok) throw new Error(`API error: ${r.status}`)
				return r.json()
			})
			.then(data => {
				setHeightMap(data.data)
				setElevationMeta({
					min: data.metadata.minElevation,
					max: data.metadata.maxElevation,
				})
			})
			.catch(e => setError(e.message))
			.finally(() => setLoading(false))
	}, [location, radius, heightMap, setHeightMap, setElevationMeta])

	return (
		<div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">
			<h2 className="text-3xl font-bold">Предпросмотр рельефа</h2>

			<div className="h-96 w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
				{loading && (
					<div className="flex h-full items-center justify-center">
						<div className="text-center">
							<div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-amber-500 mx-auto" />
							<p className="text-zinc-400">Генерируем ландшафт...</p>
						</div>
					</div>
				)}
				{error && (
					<div className="flex h-full items-center justify-center">
						<p className="text-red-400">{error}</p>
					</div>
				)}
				{heightMap && <RingViewer className="h-full w-full" />}
			</div>

			{location && (
				<div className="w-full max-w-lg space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm">
					<div className="text-lg font-semibold">{location.name}</div>
					<div className="text-zinc-400">{location.country}</div>
					<div className="font-mono text-xs text-zinc-500">
						{location.coordinates.lat.toFixed(6)}° N,{' '}
						{location.coordinates.lng.toFixed(6)}° E
					</div>
					{heightMap && (
						<div className="text-zinc-400 text-xs">
							Высота:{' '}
							{Math.round(useAppStore.getState().elevationMeta?.min ?? 0)} —{' '}
							{Math.round(useAppStore.getState().elevationMeta?.max ?? 0)} м
						</div>
					)}
				</div>
			)}

			<div className="flex gap-3">
				<button
					onClick={() => setStep('scale')}
					className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-300 transition hover:bg-zinc-800"
				>
					Назад
				</button>
				<button
					onClick={() => setStep('material')}
					disabled={!heightMap}
					className="rounded-lg bg-amber-500 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
				>
					Выбрать материал
				</button>
			</div>
		</div>
	)
}
