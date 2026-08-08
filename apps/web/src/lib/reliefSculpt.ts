/**
 * Relief sculpting for jewellery emboss.
 * Must preserve summit craters / local dips — do NOT saturate highs to 1.
 */

/** Remap 0–1 DEM: gentle contrast, keep relative dips on peaks. */
export function sculptReliefHeight(h: number): number {
	const t = Math.min(1, Math.max(0, h))
	// Tiny floor — kill only pure noise, not real depressions
	const x = Math.max(0, (t - 0.02) / 0.98)
	// Mild midtone reshape without crushing the top end
	return Math.pow(x, 0.92)
}

/**
 * Peak emboss amplitude from the UI slider.
 * Floor stays fixed; slider only scales emboss height.
 */
export function embossAmplitude(reliefHeight: number): number {
	return 0.02 + Math.max(0, reliefHeight) * 0.19
}

function smootherstep(e0: number, e1: number, x: number) {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Soft falloff toward the insert rim (disc / classic).
 * rNorm 0 = centre, 1 = edge. Returns 1 in the middle → 0 at the lip,
 * so peaks melt into polished metal instead of a vertical cliff.
 */
export function reliefRimFade(
	rNorm: number,
	start = 0.68,
	end = 0.985,
): number {
	return 1 - smootherstep(start, end, rNorm)
}
