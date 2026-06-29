import { fetchHeightMap, resampleHeightMap } from '@favplace/terrain'
import { Injectable } from '@nestjs/common'

@Injectable()
export class TerrainService {
	async getHeightMap(
		lat: number,
		lng: number,
		radius: number,
		resolution: number,
	) {
		const raw = await fetchHeightMap(lat, lng, radius)
		const heightMap = resampleHeightMap(raw, resolution)

		return {
			data: heightMap.data,
			width: heightMap.width,
			height: heightMap.height,
			metadata: {
				minElevation: raw.minElevation,
				maxElevation: raw.maxElevation,
				elevationRange: raw.maxElevation - raw.minElevation,
			},
		}
	}
}
