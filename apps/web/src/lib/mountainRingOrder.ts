import {
	normalizeAcceptedMountainRingOptions,
	type AcceptedMountainRingOptions,
	type BandProfile,
	type RingMass,
	type ShoulderStyle,
} from './acceptedMountainRing.ts'

export const RING_MASS_LABELS: Record<RingMass, string> = {
	subtle: 'Лёгкое',
	classic: 'Классика',
	statement: 'Массивное',
}

export const BAND_PROFILE_LABELS: Record<BandProfile, string> = {
	flat: 'Плоский',
	classic: 'Классика',
	'd-shaped': 'D-форма',
}

export const SHOULDER_STYLE_LABELS: Record<ShoulderStyle, string> = {
	straight: 'Прямые',
	classic: 'Классика',
	curved: 'Плавные',
}

export function mountainRingOrderLines(
	options: AcceptedMountainRingOptions,
): string[] {
	const normalized = normalizeAcceptedMountainRingOptions(options)
	return [
		`Размер кольца: ${String(normalized.ringDiameter)} мм`,
		`Массивность: ${RING_MASS_LABELS[normalized.mass]}`,
		`Профиль обруча: ${BAND_PROFILE_LABELS[normalized.profile]}`,
		`Плечи: ${SHOULDER_STYLE_LABELS[normalized.shoulders]}`,
	]
}
