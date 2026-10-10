import {
	readTerrainResponse,
	terrainFrameFromResponse,
	terrainRequestUrl,
	type TerrainRequestStage,
} from './referenceTerrainRequests.ts'
import type { TerrainFrame, TerrainGeoFrame } from './referenceSignetTerrain.ts'

export type TerrainSelection = TerrainGeoFrame & { interacting: boolean }

/** Test all four rotated corners: a nearby centre alone does not guarantee coverage. */
export function terrainFrameContains(source: TerrainGeoFrame, view: TerrainGeoFrame, margin = 0) {
	const angle = -view.bearing * Math.PI / 180
	const inv = source.bearing * Math.PI / 180
	const eastOffset = (view.lng - source.lng) * 111.32 * Math.cos(source.lat * Math.PI / 180)
	const northOffset = (view.lat - source.lat) * 111.32
	const limit = source.radiusKm * (1 - margin) + 1e-8
	for (const x of [-view.radiusKm, view.radiusKm]) {
		for (const y of [-view.radiusKm, view.radiusKm]) {
			const east = x * Math.cos(angle) - y * Math.sin(angle) + eastOffset
			const north = x * Math.sin(angle) + y * Math.cos(angle) + northOffset
			if (Math.abs(east * Math.cos(inv) - north * Math.sin(inv)) > limit ||
				Math.abs(east * Math.sin(inv) + north * Math.cos(inv)) > limit) return false
		}
	}
	return true
}

function sameFrame(a: TerrainGeoFrame, b: TerrainGeoFrame) {
	return a.lat === b.lat && a.lng === b.lng && a.radiusKm === b.radiusKm && a.bearing === b.bearing
}

type Callbacks = {
	onView: (view: TerrainGeoFrame) => void
	onFrames: (fine: TerrainFrame, coarse: TerrainFrame | null, view: TerrainGeoFrame) => void
	onBusy: (busy: boolean) => void
	onError?: (error: string | null) => void
	fetchFrame?: (stage: TerrainRequestStage, signal: AbortSignal) => Promise<TerrainFrame>
}
type ActiveRequest = { frame: TerrainGeoFrame; abort: AbortController }

/** Local crops follow the map immediately. Network jobs load regions, never every move. */
export class LiveTerrainAnalysis {
	private selection: TerrainSelection | null = null
	private frames: TerrainFrame[] = []
	private context: TerrainFrame | null = null
	private regionRequest: ActiveRequest | null = null
	private contextRequest: ActiveRequest | null = null
	private finalRequest: ActiveRequest | null = null
	private finalTimer: ReturnType<typeof setTimeout> | null = null
	private disposed = false
	private failed = false
	private readonly fetchFrame: NonNullable<Callbacks['fetchFrame']>

	private readonly callbacks: Callbacks

	constructor(callbacks: Callbacks) {
		this.callbacks = callbacks
		this.fetchFrame = callbacks.fetchFrame ?? (async (stage, signal) => {
			const response = await fetch(terrainRequestUrl(stage, true), { signal })
			return terrainFrameFromResponse(await readTerrainResponse(response), stage.final)
		})
	}

	update(selection: TerrainSelection) {
		if (this.disposed) return
		const previous = this.selection
		this.selection = selection
		if (previous && sameFrame(previous, selection) && previous.interacting === selection.interacting && !this.failed) return
		this.failed = false
		this.callbacks.onError?.(null)
		this.callbacks.onView(selection)
		this.publish()
		if (this.finalTimer) clearTimeout(this.finalTimer)
		this.finalTimer = null
		if (this.finalRequest && (selection.interacting || !sameFrame(this.finalRequest.frame, selection))) {
			this.finalRequest.abort.abort()
			this.finalRequest = null
		}

		// Keep useful downloads alive during dragging. A distant preset jump can replace them.
		for (const type of ['regionRequest', 'contextRequest'] as const) {
			const active = this[type]
			if (active && !selection.interacting && !terrainFrameContains(active.frame, selection)) {
				active.abort.abort()
				this[type] = null
			}
		}
		this.ensureRegion()
		this.ensureContext()
		if (!selection.interacting && !this.hasExactFrame(selection)) {
			this.finalTimer = setTimeout(() => {
				this.finalTimer = null
				this.loadFinal()
			}, 180)
		}
		this.reportBusy()
	}

	private hasExactFrame(view: TerrainGeoFrame) {
		return this.frames.some(frame => frame.final && sameFrame(frame.frame, view))
	}

	private publish() {
		const view = this.selection
		if (!view || this.disposed) return
		const available = this.frames.filter(frame => terrainFrameContains(frame.frame, view))
		available.sort((a, b) => b.size / b.frame.radiusKm - a.size / a.frame.radiusKm)
		const fine = available[0]
		const context = this.context && terrainFrameContains(this.context.frame, view) ? this.context : null
		if (fine) this.callbacks.onFrames(fine, context, view)
		else if (context) {
			this.callbacks.onFrames(context, context, view)
		}
	}

	private remember(frame: TerrainFrame) {
		const frames = [...this.frames.filter(other => !sameFrame(other.frame, frame.frame)), frame]
		// Repeated precise crops must not evict the wider region needed for the next drag.
		this.frames = [...frames.filter(frame => !frame.final).slice(-2), ...frames.filter(frame => frame.final).slice(-2)]
	}

	private stage(frame: TerrainGeoFrame, resolution: TerrainRequestStage['resolution'], final: boolean, zoomOffset: TerrainRequestStage['zoomOffset'] = 0): TerrainRequestStage {
		return { lat: frame.lat, lng: frame.lng, radiusMeters: frame.radiusKm * 1000, bearing: frame.bearing, resolution, zoomOffset, final, delayMs: 0 }
	}

	private ensureRegion() {
		const view = this.selection
		if (!view || this.regionRequest || this.disposed) return
		if (this.frames.some(frame => !frame.final && terrainFrameContains(frame.frame, view, .2))) return
		const frame = { ...view, radiusKm: Math.min(100, view.radiusKm * 3) }
		const active = { frame, abort: new AbortController() }
		this.regionRequest = active
		// A larger crop with native DEM zoom retained where the tile-count cap permits it.
		this.fetchFrame(this.stage(frame, 512, false, 2), active.abort.signal)
			.then(result => {
				if (this.disposed || active.abort.signal.aborted) return
				this.remember(result)
				this.publish()
			})
			.catch(error => this.reportError(error, active))
			.finally(() => {
				if (this.regionRequest !== active || this.disposed) return
				this.regionRequest = null
				// If the pointer moved beyond the download, request the latest region once.
				if (this.selection && !terrainFrameContains(frame, this.selection)) this.ensureRegion()
				this.reportBusy()
			})
	}

	private ensureContext() {
		const view = this.selection
		if (!view || this.contextRequest || this.disposed) return
		if (this.context && terrainFrameContains(this.context.frame, view, .3)) return
		const frame = { ...view, radiusKm: Math.min(100, view.radiusKm * 8) }
		const active = { frame, abort: new AbortController() }
		this.contextRequest = active
		this.fetchFrame(this.stage(frame, 256, false, -2), active.abort.signal)
			.then(result => {
				if (this.disposed || active.abort.signal.aborted) return
				this.context = result
				this.publish()
			})
			.catch(error => this.reportError(error, active))
			.finally(() => {
				if (this.contextRequest !== active || this.disposed) return
				this.contextRequest = null
				if (this.selection && !terrainFrameContains(frame, this.selection)) this.ensureContext()
				this.reportBusy()
			})
	}

	private loadFinal() {
		const view = this.selection
		if (!view || view.interacting || this.finalRequest || this.hasExactFrame(view) || this.disposed) return
		const active = { frame: { ...view }, abort: new AbortController() }
		this.finalRequest = active
		this.reportBusy()
		this.fetchFrame(this.stage(view, 1024, true), active.abort.signal)
			.then(result => {
				if (this.disposed || active.abort.signal.aborted) return
				this.remember(result)
				this.publish()
			})
			.catch(error => this.reportError(error, active))
			.finally(() => {
				if (this.finalRequest !== active || this.disposed) return
				this.finalRequest = null
				this.reportBusy()
			})
	}

	private reportError(error: unknown, active: ActiveRequest) {
		if (!this.disposed && !active.abort.signal.aborted) {
			this.failed = true
			this.callbacks.onError?.(error instanceof Error ? error.message : 'Не удалось загрузить рельеф')
		}
	}

	private reportBusy() {
		if (!this.disposed) this.callbacks.onBusy(Boolean(this.regionRequest || this.contextRequest || this.finalRequest || this.finalTimer))
	}

	dispose() {
		this.disposed = true
		if (this.finalTimer) clearTimeout(this.finalTimer)
		this.regionRequest?.abort.abort()
		this.contextRequest?.abort.abort()
		this.finalRequest?.abort.abort()
		this.frames = []
		this.context = null
	}
}
