import { Injectable } from "@nestjs/common";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

@Injectable()
export class ExportService {
  generateSTL(heightMap: number[][], params: { ringRadius: number; tubeRadius: number; reliefHeight: number; segments: number }): Buffer {
    const { ringRadius, tubeRadius, reliefHeight, segments } = params;
    const hmHeight = heightMap.length;
    const hmWidth = heightMap[0]?.length ?? 1;
    const radialSegments = 64;

    const triangles: { v1: Vec3; v2: Vec3; v3: Vec3; normal: Vec3 }[] = [];

    const getVertex = (i: number, j: number): Vec3 => {
      const u = i / segments;
      const theta = u * Math.PI * 2;
      const v = j / radialSegments;
      const phi = v * Math.PI * 2;

      const hmX = Math.min(Math.floor(u * hmWidth), hmWidth - 1);
      const hmY = Math.min(Math.floor(Math.abs(Math.sin(phi)) * 0.5 * hmHeight + hmHeight * 0.25), hmHeight - 1);
      const elevation = heightMap[Math.abs(hmY) % hmHeight][hmX];
      const displacement = elevation * reliefHeight;
      const r = tubeRadius + displacement;

      const x = (ringRadius + r * Math.cos(phi)) * Math.cos(theta);
      const y = r * Math.sin(phi);
      const z = (ringRadius + r * Math.cos(phi)) * Math.sin(theta);
      return { x, y, z };
    };

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const v1 = getVertex(i, j);
        const v2 = getVertex(i + 1, j);
        const v3 = getVertex(i, j + 1);
        const v4 = getVertex(i + 1, j + 1);

        const n1 = computeNormal(v1, v2, v3);
        const n2 = computeNormal(v3, v2, v4);

        triangles.push({ v1, v2, v3, normal: n1 });
        triangles.push({ v1: v3, v2, v3: v4, normal: n2 });
      }
    }

    return encodeBinarySTL(triangles);
  }
}

function computeNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const nx = u.y * v.z - u.z * v.y;
  const ny = u.z * v.x - u.x * v.z;
  const nz = u.x * v.y - u.y * v.x;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function encodeBinarySTL(triangles: { v1: Vec3; v2: Vec3; v3: Vec3; normal: Vec3 }[]): Buffer {
  const headerSize = 80;
  const triangleCount = triangles.length;
  const bufferSize = headerSize + 4 + triangleCount * 50;
  const buffer = Buffer.alloc(bufferSize);

  buffer.write("Favplace STL Export", 0, "ascii");
  buffer.writeUInt32LE(triangleCount, headerSize);

  let offset = headerSize + 4;
  for (const tri of triangles) {
    buffer.writeFloatLE(tri.normal.x, offset); offset += 4;
    buffer.writeFloatLE(tri.normal.y, offset); offset += 4;
    buffer.writeFloatLE(tri.normal.z, offset); offset += 4;

    buffer.writeFloatLE(tri.v1.x, offset); offset += 4;
    buffer.writeFloatLE(tri.v1.y, offset); offset += 4;
    buffer.writeFloatLE(tri.v1.z, offset); offset += 4;

    buffer.writeFloatLE(tri.v2.x, offset); offset += 4;
    buffer.writeFloatLE(tri.v2.y, offset); offset += 4;
    buffer.writeFloatLE(tri.v2.z, offset); offset += 4;

    buffer.writeFloatLE(tri.v3.x, offset); offset += 4;
    buffer.writeFloatLE(tri.v3.y, offset); offset += 4;
    buffer.writeFloatLE(tri.v3.z, offset); offset += 4;

    buffer.writeUInt16LE(0, offset); offset += 2;
  }

  return buffer;
}
