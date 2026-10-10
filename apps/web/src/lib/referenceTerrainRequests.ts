import type { TerrainFrame } from './referenceSignetTerrain.ts'

export interface TerrainRequestSelection {
	lat: number
	lng: number
	radiusMeters: number
	bearing: number
}

export interface TerrainRequestStage extends TerrainRequestSelection {
	resolution: 256 | 512 | 1024
	zoomOffset: -4 | -2 | 0 | 1 | 2
	final: boolean
	delayMs: number
}

export interface TerrainRequestPlan {
	coarse: TerrainRequestStage
	fine: readonly TerrainRequestStage[]
}

export function createTerrainRequestPlan(
	selection: TerrainRequestSelection,
): TerrainRequestPlan {
	return {
		coarse: {
			...selection,
			radiusMeters: selection.radiusMeters * 8,
			resolution: 256,
			zoomOffset: -2,
			final: true,
			delayMs: 0,
		},
		fine: [
			{ ...selection, resolution: 256, zoomOffset: -4, final: false, delayMs: 0 },
			{ ...selection, resolution: 512, zoomOffset: -2, final: false, delayMs: 80 },
			{ ...selection, resolution: 1024, zoomOffset: 0, final: true, delayMs: 650 },
		],
	}
}

export function waitForTerrainStageDelay(milliseconds: number, signal: AbortSignal) {
	if (signal.aborted) {
		return Promise.reject(new DOMException('Aborted', 'AbortError'))
	}
	if (milliseconds <= 0) return Promise.resolve()
	return new Promise<void>((resolve, reject) => {
		const finish = () => {
			signal.removeEventListener('abort', cancel)
			resolve()
		}
		const timeout = setTimeout(finish, milliseconds)
		const cancel = () => {
			clearTimeout(timeout)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		signal.addEventListener('abort', cancel, { once: true })
	})
}

export function terrainRequestUrl(stage: TerrainRequestStage, binary = false) {
	const params = new URLSearchParams({
		lat: String(stage.lat),
		lng: String(stage.lng),
		radius: String(stage.radiusMeters),
		resolution: String(stage.resolution),
		bearing: String(stage.bearing),
		zoomOffset: String(stage.zoomOffset),
	})
	if (binary) params.set('format', 'f32')
	return `/api/terrain/heightmap?${params.toString()}`
}

export async function readTerrainResponse(response: Response): Promise<TerrainApiResponse> {
	if (!response.ok) throw new Error(`Terrain API ${response.status}`)
	if (!response.headers.get('content-type')?.includes('application/octet-stream')) {
		return response.json() as Promise<TerrainApiResponse>
	}
	const metadata = response.headers.get('X-Terrain-Metadata')
	if (!metadata) throw new Error('Terrain metadata is missing')
	const info = JSON.parse(metadata) as Omit<TerrainApiResponse, 'data'>
	if (!Number.isInteger(info.width) || info.width < 64 || info.width > 1024 || info.height !== info.width) {
		throw new Error('Invalid terrain dimensions')
	}
	const buffer = await response.arrayBuffer()
	if (buffer.byteLength !== info.width * info.height * 4) throw new Error('Incomplete terrain data')
	const values = new DataView(buffer)
	const data = Array.from({ length: info.height }, (_, y) =>
		Array.from({ length: info.width }, (_, x) => values.getFloat32((y * info.width + x) * 4, true)),
	)
	return { ...info, data }
}

export interface TerrainApiResponse {
	data: number[][]
	width: number
	height: number
	metadata: {
		minElevation: number
		maxElevation: number
	}
	frame: TerrainFrame['frame']
}

export function terrainFrameFromResponse(
	response: TerrainApiResponse,
	final: boolean,
): TerrainFrame {
	return {
		data: response.data,
		size: response.width,
		minElev: response.metadata.minElevation,
		maxElev: response.metadata.maxElevation,
		frame: response.frame,
		final,
	}
}

export function createLatestRequestGate() {
	let generation = 0
	return {
		begin() {
			generation += 1
			return generation
		},
		isCurrent(candidate: number) {
			return candidate === generation
		},
	}
}
