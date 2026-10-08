export interface TerrainGeoFrame {
	lat: number
	lng: number
	radiusKm: number
	bearing: number
}

const METERS_PER_DEGREE = 111_320

function finite(value: number, fallback = 0) {
	return Number.isFinite(value) ? value : fallback
}

export function normalizeBearing(degrees: number) {
	const wrapped = finite(degrees) % 360
	return wrapped < -180 ? wrapped + 360 : wrapped > 180 ? wrapped - 360 : wrapped
}

export function clampZoomOffset(value: number) {
	return Math.min(2, Math.max(-6, Math.round(finite(value))))
}

export function createTerrainGeoFrame(
	lat: number,
	lng: number,
	radiusMeters: number,
	bearing = 0,
): TerrainGeoFrame {
	return {
		lat: finite(lat),
		lng: finite(lng),
		radiusKm: Math.max(0.001, finite(radiusMeters, 1) / 1000),
		bearing: normalizeBearing(bearing),
	}
}

export function contextTerrainGeoFrame(
	frame: TerrainGeoFrame,
	scale = 8,
): TerrainGeoFrame {
	return {
		...frame,
		radiusKm: frame.radiusKm * Math.max(1, finite(scale, 8)),
	}
}

export function cropEnvelopeScale(bearing: number) {
	const radians = (normalizeBearing(bearing) * Math.PI) / 180
	return Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))
}

/**
 * Maps normalized crop coordinates to a geographic point. x grows eastward and
 * y grows southward, matching raster row order. Bearing rotates the selected
 * square around its centre without changing the requested physical radius.
 */
export function rotatedCropCoordinate(
	centerLat: number,
	centerLng: number,
	radiusMeters: number,
	bearing: number,
	x: number,
	y: number,
) {
	const radians = (normalizeBearing(bearing) * Math.PI) / 180
	const cosine = Math.cos(radians)
	const sine = Math.sin(radians)
	const rotatedX = x * cosine - y * sine
	const rotatedY = x * sine + y * cosine
	const latitudeRadius = radiusMeters / METERS_PER_DEGREE
	const longitudeRadius =
		radiusMeters /
		(METERS_PER_DEGREE * Math.max(1e-6, Math.cos((centerLat * Math.PI) / 180)))
	return {
		lat: centerLat - rotatedY * latitudeRadius,
		lng: centerLng + rotatedX * longitudeRadius,
	}
}
