'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { LiveTerrainAnalysis } from './liveTerrainAnalysis'

export function useTerrainAnalysis() {
	const [fetching, setFetching] = useState(false)
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		const analysis = new LiveTerrainAnalysis({
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
	}, [])
	return { fetching, error }
}
