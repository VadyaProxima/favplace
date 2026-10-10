import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repository's TypeScript sources without changing its build setup.
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
    throw error;
  }
}});
const root = dirname(fileURLToPath(import.meta.url));
const assets = resolve(root, 'assets');
mkdirSync(assets, { recursive: true });
const { fetchHeightMap } = await import('../../packages/terrain/src/heightmap.ts');
const { buildAcceptedReliefModel } = await import('../../apps/web/src/lib/acceptedMountainRelief.ts');
const frame = { lat: 43.3499, lng: 42.4453, radiusKm: 4, bearing: 0 };
const cache = resolve(assets, 'elbrus-heightmap.json');
let heights;
if (existsSync(cache)) heights = JSON.parse(readFileSync(cache, 'utf8'));
else {
  console.log('Fetching real Elbrus terrain from AWS Terrarium...');
  heights = await fetchHeightMap(frame.lat, frame.lng, frame.radiusKm * 1000, { resolution: 512 });
  writeFileSync(cache, JSON.stringify(heights));
}
const model = buildAcceptedReliefModel({
  ringDiameter: 17, mass: 'classic', profile: 'classic', shoulders: 'classic',
  fine: { data: heights.data, size: heights.width, minElev: heights.minElevation,
    maxElev: heights.maxElevation, frame, final: true },
  relief: .94, detail: 'high', preview: false,
});
const geometry = model.geometry;
for (const [name, array] of [
  ['ring-position.f32', geometry.attributes.position.array],
  ['ring-normal.f32', geometry.attributes.normal.array],
  ['ring-index.u32', geometry.index.array],
]) writeFileSync(resolve(assets, name), Buffer.from(array.buffer, array.byteOffset, array.byteLength));
const metadata = {
  place: 'Elbrus', source: 'AWS Terrain Tiles / Terrarium', frame,
  minElevation: heights.minElevation, maxElevation: heights.maxElevation,
  groups: geometry.groups, bounds: { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() },
  stats: model.stats, vertexCount: geometry.attributes.position.count,
  triangleCount: geometry.index.count / 3,
};
writeFileSync(resolve(assets, 'metadata.json'), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata, null, 2));
