import * as THREE from "three";
import { HeightMap } from "./heightmap";

export interface RingMeshParams {
  ringRadius: number;
  ringWidth: number;
  reliefHeight: number;
  segments: number;
}

const DEFAULT_PARAMS: RingMeshParams = {
  ringRadius: 1,
  ringWidth: 0.15,
  reliefHeight: 0.08,
  segments: 256,
};

export function buildRingGeometry(heightMap: HeightMap, params: Partial<RingMeshParams> = {}): THREE.BufferGeometry {
  const p = { ...DEFAULT_PARAMS, ...params };
  const { ringRadius, ringWidth, reliefHeight, segments } = p;
  const { data, width, height } = heightMap;

  const innerRadius = ringRadius - ringWidth / 2;
  const outerRadius = ringRadius + ringWidth / 2;
  const radialSegments = 64;

  const vertexCount = (segments + 1) * (radialSegments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let idx = 0;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j <= radialSegments; j++) {
      const phi = (j / radialSegments) * Math.PI * 2;
      const cosF = Math.cos(phi);
      const sinF = Math.sin(phi);

      const hmX = Math.floor((i / segments) * (width - 1));
      const hmY = Math.floor((Math.abs(sinF) * 0.5 + 0.5) * (height - 1));
      const elevation = data[Math.min(hmY, height - 1)][Math.min(hmX, width - 1)];

      const displacement = elevation * reliefHeight;
      const tubeRadius = ringWidth / 2 + displacement;

      const r = ringRadius + tubeRadius * cosF;
      const x = r * cosT;
      const y = tubeRadius * sinF;
      const z = r * sinT;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      const nx = cosF * cosT;
      const ny = sinF;
      const nz = cosF * sinT;
      normals[idx * 3] = nx;
      normals[idx * 3 + 1] = ny;
      normals[idx * 3 + 2] = nz;

      uvs[idx * 2] = i / segments;
      uvs[idx * 2 + 1] = j / radialSegments;

      idx++;
    }
  }

  const indexCount = segments * radialSegments * 6;
  const indices = new Uint32Array(indexCount);
  let triIdx = 0;

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (radialSegments + 1) + j;
      const d = c + 1;

      indices[triIdx++] = a;
      indices[triIdx++] = c;
      indices[triIdx++] = b;
      indices[triIdx++] = b;
      indices[triIdx++] = c;
      indices[triIdx++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return geometry;
}

export function buildFlatRingGeometry(params: Partial<RingMeshParams> = {}): THREE.BufferGeometry {
  const p = { ...DEFAULT_PARAMS, ...params };
  return new THREE.TorusGeometry(p.ringRadius, p.ringWidth / 2, 64, p.segments);
}
