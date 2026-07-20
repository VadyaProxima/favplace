export type ReliefDetail = 'low' | 'medium' | 'high'

/** Wildring-style detail radii (Gaussian σ in grid cells). */
export const DETAIL_SMOOTHING: Record<ReliefDetail, number> = {
	low: 4,
	medium: 2,
	high: 0,
}

function gaussianKernel(radius: number): Float32Array {
	const sigma = Math.max(radius / 2, 0.5)
	const size = Math.ceil(radius) * 2 + 1
	const half = (size - 1) / 2
	const kernel = new Float32Array(size)
	let sum = 0
	for (let i = 0; i < size; i++) {
		const x = i - half
		const w = Math.exp(-(x * x) / (2 * sigma * sigma))
		kernel[i] = w
		sum += w
	}
	for (let i = 0; i < size; i++) kernel[i] /= sum
	return kernel
}

function convolve1D(
	src: Float32Array,
	w: number,
	h: number,
	kernel: Float32Array,
	horizontal: boolean,
): Float32Array {
	const out = new Float32Array(src.length)
	const half = (kernel.length - 1) / 2

	if (horizontal) {
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				let v = 0
				for (let k = 0; k < kernel.length; k++) {
					const sx = Math.min(w - 1, Math.max(0, x + k - half))
					v += src[y * w + sx] * kernel[k]
				}
				out[y * w + x] = v
			}
		}
	} else {
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				let v = 0
				for (let k = 0; k < kernel.length; k++) {
					const sy = Math.min(h - 1, Math.max(0, y + k - half))
					v += src[sy * w + x] * kernel[k]
				}
				out[y * w + x] = v
			}
		}
	}
	return out
}

/** Separable Gaussian blur on a normalised height grid. */
export function smoothHeightGrid(data: number[][], radius: number): number[][] {
	if (radius <= 0 || data.length === 0) return data
	const h = data.length
	const w = data[0]?.length ?? 0
	if (w === 0) return data

	const flat = new Float32Array(h * w)
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const v = data[y][x]
			flat[y * w + x] = Number.isFinite(v) ? v : 0
		}
	}

	const kernel = gaussianKernel(radius)
	const tmp = convolve1D(flat, w, h, kernel, true)
	const out = convolve1D(tmp, w, h, kernel, false)

	const result: number[][] = []
	for (let y = 0; y < h; y++) {
		const row: number[] = []
		for (let x = 0; x < w; x++) {
			const v = out[y * w + x]
			row.push(Number.isFinite(v) ? v : 0)
		}
		result.push(row)
	}
	return result
}

export function smoothHeightGridByDetail(
	data: number[][],
	detail: ReliefDetail = 'medium',
): number[][] {
	return smoothHeightGrid(data, DETAIL_SMOOTHING[detail])
}
