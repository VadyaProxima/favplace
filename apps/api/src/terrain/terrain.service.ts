import {
	createTerrainGeoFrame,
	fetchHeightMap,
	resampleHeightMap,
} from '@favplace/terrain'
import {
	BadGatewayException,
	BadRequestException,
	Injectable,
	Logger,
} from '@nestjs/common'

@Injectable()
export class TerrainService {
	private readonly logger = new Logger(TerrainService.name)

	async getHeightMap(
		lat: number,
		lng: number,
		radius: number,
		resolution: number,
		bearing = 0,
		zoomOffset = 0,
	) {
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			throw new BadRequestException('lat and lng must be finite numbers')
		}
		if (!Number.isFinite(radius) || radius <= 0) {
			throw new BadRequestException('radius must be a positive number')
		}

		const clampedRadius = Math.min(Math.max(radius, 50), 100_000)
		const clampedRes = Math.min(Math.max(Math.round(resolution) || 512, 64), 1024)

		try {
			const raw = await fetchHeightMap(lat, lng, clampedRadius, {
				bearing,
				zoomOffset,
				resolution: clampedRes,
			})
			const heightMap = resampleHeightMap(raw, clampedRes)

			return {
				data: heightMap.data,
				width: heightMap.width,
				height: heightMap.height,
				metadata: {
					minElevation: raw.minElevation,
					maxElevation: raw.maxElevation,
					elevationRange: raw.maxElevation - raw.minElevation,
					demSource: raw.demSource ?? 'mapbox',
					tileZoom: raw.tileZoom ?? 0,
				},
				frame: createTerrainGeoFrame(lat, lng, clampedRadius, bearing),
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Terrain fetch failed'
			this.logger.error(`heightmap failed lat=${lat} lng=${lng} r=${clampedRadius}: ${message}`)
			throw new BadGatewayException(message)
		}
	}
}
