import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw error;}}});
const root=dirname(fileURLToPath(import.meta.url));
const out=resolve(root,'../../apps/web/public/hero/beshtau');
mkdirSync(out,{recursive:true});
const {fetchHeightMap}=await import('../../packages/terrain/src/heightmap.ts');
const {buildAcceptedReliefModel}=await import('../../apps/web/src/lib/acceptedMountainRelief.ts');
const {MIN_RELIEF_MM,MAX_RELIEF_MM}=await import('../../apps/web/src/lib/referenceSignetTerrain.ts');
const frame={lat:44.09865,lng:43.02519,radiusKm:2.179,bearing:-90};
const coarseFrame={...frame,radiusKm:frame.radiusKm*8};
const cache=resolve(root,'terrain-cache.json');
let fine,coarse;
if(existsSync(cache))({fine,coarse}=JSON.parse(readFileSync(cache,'utf8')));
else{
  console.log('Fetching the same final and context terrain requests as the configurator...');
  [fine,coarse]=await Promise.all([
    fetchHeightMap(frame.lat,frame.lng,2179,{resolution:1024,bearing:-90,zoomOffset:0}),
    fetchHeightMap(frame.lat,frame.lng,2179*8,{resolution:256,bearing:-90,zoomOffset:-2})
  ]);
  writeFileSync(cache,JSON.stringify({fine,coarse}));
}
const terrain=(map,geo,final)=>({data:map.data.map(row=>row.map(Math.fround)),size:map.width,minElev:map.minElevation,maxElev:map.maxElevation,frame:geo,final});
const options={ringDiameter:17,mass:'classic',profile:'classic',shoulders:'classic',
  fine:terrain(fine,frame,true),coarse:terrain(coarse,coarseFrame,false),view:frame,
  relief:(3.77-MIN_RELIEF_MM)/(MAX_RELIEF_MM-MIN_RELIEF_MM),detail:'high',preview:false};
const {geometry,stats}=buildAcceptedReliefModel(options);
const position=geometry.attributes.position.array,normal=geometry.attributes.normal.array,index=geometry.index.array;
// 16-bit positions retain <0.0002 mm error, far below the original DEM detail.
// Delta-coded indices avoid sending a six-megabyte triangle buffer to a hero.
const bounds={min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()};
const qp=new Uint16Array(position.length),qn=new Int16Array(normal.length);
for(let i=0;i<position.length;i++){
  const axis=i%3;
  qp[i]=Math.round((position[i]-bounds.min[axis])/(bounds.max[axis]-bounds.min[axis])*65535);
  qn[i]=Math.round(Math.max(-1,Math.min(1,normal[i]))*32767);
}
const delta=[];let previous=0;
for(const id of index){let difference=id-previous;previous=id;let n=difference>=0?difference*2:-difference*2-1;while(n>127){delta.push((n&127)|128);n>>>=7;}delta.push(n);}
const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
const packed=Buffer.concat([bytes(qp),bytes(qn),Buffer.from(delta)]);
writeFileSync(resolve(out,'mesh.bin'),packed);
writeFileSync(resolve(out,'mesh.bin.gz'),gzipSync(packed,{level:9}));
const metadata={version:1,place:'Бештау',frame,configuration:{height:3.77,size:17,material:'silver',finish:'polished',detail:'high',weight:'classic',bandProfile:'classic',shoulders:'classic'},
  source:'AWS Terrain Tiles / Terrarium',minElevation:fine.minElevation,maxElevation:fine.maxElevation,
  encoding:'quantized-u16-i16-delta-v1',positionBytes:qp.byteLength,normalBytes:qn.byteLength,indexBytes:delta.length,
  vertexCount:position.length/3,indexCount:index.length,bodyIndexCount:geometry.groups[0].count,
  bounds,stats};
writeFileSync(resolve(out,'metadata.json'),JSON.stringify(metadata,null,2));
console.log(JSON.stringify({...metadata,rawBytes:packed.length,gzipBytes:gzipSync(packed,{level:9}).length},null,2));
