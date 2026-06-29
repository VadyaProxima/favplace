export { fetchHeightMap, resampleHeightMap, computeRadiusInDegrees } from "./heightmap";
export type { HeightMap } from "./heightmap";
export { buildRingGeometry, buildFlatRingGeometry } from "./mesh";
export type { RingMeshParams } from "./mesh";
export { getZoomForRadius, latLngToTile } from "./tiles";
export type { TileCoord } from "./tiles";

import { fetchHeightMap, resampleHeightMap, HeightMap } from "./heightmap";
import { buildRingGeometry, RingMeshParams } from "./mesh";
import * as THREE from "three";

export interface GenerateTerrainRingParams {
  center: { lat: number; lng: number };
  radius: number;
  resolution?: number;
  ringWidth?: number;
  reliefHeight?: number;
  ringRadius?: number;
}

export interface GenerateTerrainRingResult {
  geometry: THREE.BufferGeometry;
  heightMap: HeightMap;
  metadata: {
    minElevation: number;
    maxElevation: number;
    elevationRange: number;
    tileZoom: number;
  };
}

export async function generateTerrainRing(
  params: GenerateTerrainRingParams,
): Promise<GenerateTerrainRingResult> {
  const { center, radius, resolution = 128, ringWidth = 0.15, reliefHeight = 0.08, ringRadius = 1 } = params;

  const rawHeightMap = await fetchHeightMap(center.lat, center.lng, radius);
  const heightMap = resampleHeightMap(rawHeightMap, resolution);

  const meshParams: Partial<RingMeshParams> = {
    ringRadius,
    ringWidth,
    reliefHeight,
    segments: resolution * 2,
  };

  const geometry = buildRingGeometry(heightMap, meshParams);

  return {
    geometry,
    heightMap,
    metadata: {
      minElevation: rawHeightMap.minElevation,
      maxElevation: rawHeightMap.maxElevation,
      elevationRange: rawHeightMap.maxElevation - rawHeightMap.minElevation,
      tileZoom: 0,
    },
  };
}
