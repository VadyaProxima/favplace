'use client'

import { decodeConfigParams, encodeConfigParams } from '@/lib/configUrl'
import { useAppStore } from '@/store/useAppStore'
import { useEffect, useRef, useState } from 'react'

export function buildConfigParams(): URLSearchParams {
	return encodeConfigParams(useAppStore.getState())
}

/** Read the live state, including a change made just before clicking Share. */
export function buildShareUrl(): string {
	if (typeof window === 'undefined') return ''
	return `${window.location.origin}${window.location.pathname}?${buildConfigParams()}`
}

/** Restore the whole selection before a map or terrain worker can publish default values. */
export function useConfigUrl(): number {
	const initialized = useRef(false)
	const [revision, setRevision] = useState(0)
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined
		const hydrate = () => {
			clearTimeout(timer)
			const config = decodeConfigParams(window.location.search, useAppStore.getInitialState())
			useAppStore.setState({
				...config, interacting: false, engraving: '',
				heightMap: null, contextHeightMap: null, terrainFrame: null,
				coarseTerrainFrame: null, terrainViewFrame: null, elevationMeta: null,
				edgeLocation: null, edgeTerrainFrame: null, edgeCoarseTerrainFrame: null,
			})
			setRevision(value => value + 1)
		}
		if (!initialized.current) { initialized.current = true; hydrate() }
		let lastConfig = buildConfigParams().toString()
		const write = () => {
			clearTimeout(timer)
			timer = setTimeout(() => {
				const next = `${window.location.pathname}?${buildConfigParams()}${window.location.hash}`
				if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
					window.history.replaceState(window.history.state, '', next)
				}
			}, 600)
		}
		write()
		const unsubscribe = useAppStore.subscribe(state => {
			const next = encodeConfigParams(state).toString()
			if (next === lastConfig) return
			lastConfig = next
			write()
		})
		const restore = () => { hydrate(); lastConfig = buildConfigParams().toString(); write() }
		window.addEventListener('popstate', restore)
		return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener('popstate', restore) }
	}, [])
	return revision
}
