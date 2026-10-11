import { RING_FORMS, RING_SIZES_MM } from '@favplace/shared'
import type { useAppStore } from '../store/useAppStore.ts'
import { MAX_RELIEF_MM, MIN_RELIEF_MM, reliefMillimeters } from './referenceSignetTerrain.ts'

export type SharedConfig = Pick<ReturnType<typeof useAppStore.getState>,
	'location' | 'radius' | 'terrainBearing' | 'reliefHeight' | 'reliefScale' |
	'reliefDetail' | 'ringForm' | 'ringSize' | 'ringWeight' | 'bandProfile' | 'shoulderStyle' | 'step'>

export const MIN_SELECTION_RADIUS = 100
export const MAX_SELECTION_RADIUS = 20000

/** Use the full numeric values: display rounding must not change the shared model. */
export function encodeConfigParams(config: SharedConfig): URLSearchParams {
	const p = new URLSearchParams({
		form: config.ringForm, d: config.reliefDetail,
		h: String(config.reliefHeight), rs: String(config.reliefScale),
		sz: String(config.ringSize), r: String(config.radius),
		w: config.ringWeight, bp: config.bandProfile, sh: config.shoulderStyle,
		b: String(config.terrainBearing), s: config.step,
	})
	if (config.location) {
		p.set('lat', String(config.location.coordinates.lat))
		p.set('lng', String(config.location.coordinates.lng))
		p.set('p', config.location.name)
		if (config.location.country) p.set('c', config.location.country)
	}
	return p
}

/** Missing/invalid values use defaults, never values left by a previously opened ring. */
export function decodeConfigParams(search: string, defaults: SharedConfig): SharedConfig {
	const p = new URLSearchParams(search)
	const number = (key: string, min: number, max: number) => {
		const raw = p.get(key)
		if (raw === null || raw.trim() === '') return undefined
		const value = Number(raw)
		return Number.isFinite(value) && value >= min && value <= max ? value : undefined
	}
	const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
		const value = p.get(key)
		return value !== null && (values as readonly string[]).includes(value) ? value as T : fallback
	}
	const height = number('h', MIN_RELIEF_MM, MAX_RELIEF_MM)
	const scale = number('rs', 0, 1)
	// Legacy links store only millimetres. New links also preserve the exact slider value.
	// An explicitly edited height still wins if it disagrees with the saved slider.
	const useScale = scale !== undefined && (height === undefined || Math.abs(reliefMillimeters(scale) - height) < 1e-9)
	const reliefHeight = useScale ? reliefMillimeters(scale!) : height ?? defaults.reliefHeight
	const reliefScale = useScale ? scale! : height === undefined ? defaults.reliefScale
		: (height - MIN_RELIEF_MM) / (MAX_RELIEF_MM - MIN_RELIEF_MM)
	const lat = number('lat', -90, 90), lng = number('lng', -180, 180)
	const size = number('sz', 0, 100)
	return {
		ringForm: choice('form', RING_FORMS, defaults.ringForm),
		reliefDetail: choice('d', ['low', 'medium', 'high'], defaults.reliefDetail),
		reliefHeight, reliefScale,
		ringSize: size !== undefined && RING_SIZES_MM.includes(size) ? size : defaults.ringSize,
		radius: number('r', MIN_SELECTION_RADIUS, MAX_SELECTION_RADIUS) ?? defaults.radius,
		ringWeight: choice('w', ['subtle', 'classic', 'statement'], defaults.ringWeight),
		bandProfile: choice('bp', ['flat', 'classic', 'd-shaped'], defaults.bandProfile),
		shoulderStyle: choice('sh', ['straight', 'classic', 'curved'], defaults.shoulderStyle),
		terrainBearing: number('b', -180, 180) ?? defaults.terrainBearing,
		location: lat !== undefined && lng !== undefined ? {
			id: crypto.randomUUID(), name: p.get('p') || 'Выбранное место', country: p.get('c') || '', coordinates: { lat, lng },
		} : null,
		step: p.get('s') === 'material' ? 'form' : choice('s', ['place', 'relief', 'form', 'size', 'order'], defaults.step),
	}
}
