'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { LiveTerrainAnalysis } from './liveTerrainAnalysis'
import type { TerrainProvider } from './referenceTerrainRequests'

export function useTerrainAnalysis(provider?: TerrainProvider) {
	const [fetching, setFetching] = useState(false)
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		useAppStore.setState({ terrainFrame: null, coarseTerrainFrame: null, terrainViewFrame: null,
			heightMap: null, contextHeightMap: null, elevationMeta: null })
		const analysis = new LiveTerrainAnalysis({
			provider,
			onView: view => useAppStore.getState().setTerrainViewFrame(view),
			onFrames: (fine, coarse, view) => {
				const state = useAppStore.getState()
				if (state.terrainFrame !== fine || state.coarseTerrainFrame !== coarse) {
					state.setReferenceTerrainFrames(fine, coarse, view)
				}
			},
			onBusy: setFetching,
			onError: setError,
		})
		const update = () => {
			const { location, radius, terrainBearing, interacting } = useAppStore.getState()
			if (location) analysis.update({ ...location.coordinates, radiusKm: radius / 1000, bearing: terrainBearing, interacting })
		}
		const unsubscribe = useAppStore.subscribe((state, previous) => {
			if (state.location?.coordinates !== previous.location?.coordinates || state.radius !== previous.radius ||
				state.terrainBearing !== previous.terrainBearing || state.interacting !== previous.interacting) update()
		})
		update()
		return () => { unsubscribe(); analysis.dispose() }
	}, [provider])
	return { fetching, error }
}
