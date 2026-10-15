import hero from '../../public/hero/beshtau/metadata.json' with { type: 'json' }
import { encodeConfigParams, type SharedConfig } from './configUrl.ts'
import { MIN_RELIEF_MM, MAX_RELIEF_MM } from './referenceSignetTerrain.ts'

/** Keep the initial studio ring and hero link aligned with the actual hero asset. */
export const DEFAULT_STUDIO_CONFIG: SharedConfig = {
	location: { id: 'featured-beshtau', name: hero.place, country: '', coordinates: { lat: hero.frame.lat, lng: hero.frame.lng } },
	radius: hero.frame.radiusKm * 1000,
	terrainBearing: hero.frame.bearing,
	reliefHeight: hero.configuration.height,
	reliefScale: (hero.configuration.height - MIN_RELIEF_MM) / (MAX_RELIEF_MM - MIN_RELIEF_MM),
	reliefDetail: hero.configuration.detail as SharedConfig['reliefDetail'],
	ringForm: 'mountain',
	ringSize: hero.configuration.size,
	ringWeight: hero.configuration.weight as SharedConfig['ringWeight'],
	bandProfile: hero.configuration.bandProfile as SharedConfig['bandProfile'],
	shoulderStyle: hero.configuration.shoulders as SharedConfig['shoulderStyle'],
	step: 'place',
}

export const FEATURED_RING_STUDIO_URL = `/create?${encodeConfigParams({ ...DEFAULT_STUDIO_CONFIG, step: 'relief' })}`
