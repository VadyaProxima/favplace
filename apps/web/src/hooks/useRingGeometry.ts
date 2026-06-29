import { useMemo } from "react";
import * as THREE from "three";
import { buildTerrainRingGeometry, buildFlatTorus } from "@/lib/ringGeometry";

interface UseRingGeometryParams {
  heightMap: number[][] | null;
  reliefHeight: number;
  ringWidth: number;
}

export function useRingGeometry({ heightMap, reliefHeight, ringWidth }: UseRingGeometryParams) {
  return useMemo(() => {
    const tubeRadius = ringWidth / 10;

    if (!heightMap || heightMap.length === 0) {
      return buildFlatTorus(1, tubeRadius);
    }

    return buildTerrainRingGeometry(heightMap, {
      ringRadius: 1,
      tubeRadius,
      reliefHeight: reliefHeight / 20,
      tubularSegments: Math.min(heightMap.length * 2, 512),
      radialSegments: 64,
    });
  }, [heightMap, reliefHeight, ringWidth]);
}
