'use client'

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'

interface MapProps {
	center: [number, number]
	zoom?: number
	onMarkerMove?: (lng: number, lat: number) => void
}

export function Map({ center, zoom = 12, onMarkerMove }: MapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<maplibregl.Map | null>(null)
	const markerRef = useRef<maplibregl.Marker | null>(null)

	useEffect(() => {
		if (!containerRef.current || mapRef.current) return

		const container = containerRef.current

		const map = new maplibregl.Map({
			container,
			style: 'https://tiles.openfreemap.org/styles/liberty',
			center,
			zoom,
		})

		map.addControl(new maplibregl.NavigationControl(), 'top-right')

		const marker = new maplibregl.Marker({ draggable: !!onMarkerMove })
			.setLngLat(center)
			.addTo(map)

		if (onMarkerMove) {
			marker.on('dragend', () => {
				const lngLat = marker.getLngLat()
				onMarkerMove(lngLat.lng, lngLat.lat)
			})
		}

		mapRef.current = map
		markerRef.current = marker

		return () => {
			markerRef.current = null
			mapRef.current = null
			try {
				map.remove()
			} catch {}
		}
	}, [])

	useEffect(() => {
		if (mapRef.current) {
			mapRef.current.flyTo({ center, zoom, duration: 1000 })
		}
		if (markerRef.current) {
			markerRef.current.setLngLat(center)
		}
	}, [center, zoom])

	return <div ref={containerRef} className="h-full w-full" />
}
