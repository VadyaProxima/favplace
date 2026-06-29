import {
	buildRingBandGeometry,
	buildTerrainInsertGeometry,
} from '@/lib/ringGeometry'
import { useMemo } from 'react'
import * as THREE from 'three'

interface UseRingGeometryParams {
	heightMap: number[][] | null
	reliefHeight: number
	ringWidth: number
}

export function useRingGeometries({
	heightMap,
	reliefHeight,
	ringWidth,
}: UseRingGeometryParams) {
	const tubeRadius = ringWidth / 10

	return useMemo(() => {
		const band = buildRingBandGeometry({
			ringRadius: 1,
			tubeRadius,
			tubularSegments: 128,
		})

		let insert: THREE.BufferGeometry | null = null
		if (heightMap && heightMap.length > 0) {
			insert = buildTerrainInsertGeometry(heightMap, {
				ringRadius: 1,
				tubeRadius,
				reliefHeight: reliefHeight / 20,
				tubularSegments: Math.min(heightMap.length * 2, 512),
			})
		}

		return { band, insert }
	}, [heightMap, reliefHeight, ringWidth, tubeRadius])
}
