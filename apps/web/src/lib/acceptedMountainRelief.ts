import * as THREE from 'three'
import { buildAcceptedMountainRing, normalizeAcceptedMountainRingOptions, type AcceptedMountainRingOptions } from './acceptedMountainRing.ts'
import type { TerrainFrame, TerrainGeoFrame } from './referenceSignetTerrain.ts'
import { refineReliefTransition } from './refineReliefTransition.ts'
import { buildReliefMacroField } from './reliefMacroField.ts'

/** Independently authored crown remeshing, 2026-09-05. No reference-body deformation. */
export type AcceptedReliefOptions = AcceptedMountainRingOptions & {
 fine: TerrainFrame
 coarse?: TerrainFrame | null
 view?: TerrainGeoFrame | null
 relief?: number
 detail?: 'low' | 'medium' | 'high'
}
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n))
const smooth=(n:number)=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10)}
const crownBaseReduction=.75 // mm total; never reduce terrain amplitude or the bore.

/** The server samples grid NODES, not pixel centres. Keep all linear slopes linear. */
/** Catmull-Rom по одной оси: непрерывна по значению и по производной. */
function cubic(p0:number,p1:number,p2:number,p3:number,t:number) {
 const t2=t*t,t3=t2*t
 return .5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)
}

export function sampleElevation(f:TerrainFrame,u:number,v:number) {
 const x=clamp(u)*(f.size-1),y=(1-clamp(v))*(f.size-1)
 const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy
 // Промежуточные ступени приходят сеткой 256, а меш кольца — 384 узла,
 // то есть идёт увеличение. Линейная интерполяция дала бы здесь грани.
 const at=(cx:number,cy:number)=>
  f.data[Math.min(Math.max(cy,0),f.size-1)][Math.min(Math.max(cx,0),f.size-1)]
 const row=(o:number)=>cubic(at(ix-1,iy+o),at(ix,iy+o),at(ix+1,iy+o),at(ix+2,iy+o),dx)
 return f.minElev+cubic(row(-1),row(0),row(1),row(2),dy)*(f.maxElev-f.minElev)
}

function project(u:number,v:number,view:TerrainGeoFrame,source:TerrainGeoFrame) {
 const angle=-view.bearing*Math.PI/180, inv=source.bearing*Math.PI/180
 const x=(u-.5)*2*view.radiusKm,y=(v-.5)*2*view.radiusKm
 const east=x*Math.cos(angle)-y*Math.sin(angle)+(view.lng-source.lng)*111.32*Math.cos(source.lat*Math.PI/180)
 const north=x*Math.sin(angle)+y*Math.cos(angle)+(view.lat-source.lat)*111.32
 return [.5+(east*Math.cos(inv)-north*Math.sin(inv))/(2*source.radiusKm),
 .5+(east*Math.sin(inv)+north*Math.cos(inv))/(2*source.radiusKm)] as const
}

export function sampleTerrainElevation(fine:TerrainFrame,coarse:TerrainFrame|null|undefined,view:TerrainGeoFrame,u:number,v:number) {
 const uv=project(u,v,view,fine.frame)
 const margin=Math.min(uv[0],1-uv[0],uv[1],1-uv[1])
 if(margin>=.04||!coarse)return sampleElevation(fine,...uv)
 const contextUv=project(u,v,view,coarse.frame)
 if(contextUv.some(n=>n<0||n>1))return sampleElevation(fine,...uv)
 const contextElevation=sampleElevation(coarse,...contextUv)
 if(margin<=0)return contextElevation
 const weight=smooth(margin/.04)
 return sampleElevation(fine,...uv)*weight+contextElevation*(1-weight)
}

function cyclicRange(start:number,end:number,count:number) {
 const result=[start];while(result.at(-1)!==end)result.push((result.at(-1)!+1)%count)
 return result
}
function locate(values:number[],t:number) {
 const target=values[0]+clamp(t)*(values.at(-1)!-values[0])
 let lo=0,hi=values.length-1
 while(hi-lo>1){const mid=(lo+hi)>>1;if(values[mid]<=target)lo=mid;else hi=mid}
 return lo+clamp((target-values[lo])/Math.max(1e-9,values[hi]-values[lo]))
}

type ReliefSource = {
 positions:Float64Array
 normals:Float64Array
 indices:Uint32Array
 crownStart:number
 seamVertices:Set<number>
 normalizationVertices:number[]
 footprint:number
 releaseY:number
 fullY:number
 macroBounds:{xMin:number,xMax:number,zMin:number,zMax:number}
 terrainReleaseY:number
 terrainFullY:number
 grid:number[]
 reliefVertexCount:number
}
// Cache only unwarped data, never mutable Three geometry. Map movement and
// height/detail changes reuse the expensive, validated ring/transition source.
const sourceCache=new Map<string,ReliefSource>()

function buildReliefSource(options:AcceptedMountainRingOptions):ReliefSource {
 const base=buildAcceptedMountainRing(options)
 const original=base.originalPositions,sc=base.sectionCount
 const originalNormals=base.geometry.attributes.normal.array
 const sourceNormals:number[]=Array.from(originalNormals)
 const radials=cyclicRange(base.faceEdges[1],base.faceEdges[0],base.radialCount)
 // Start after the cyclic gap, never interpolate through the finger hole.
 const sorted=base.sectionSurfaceIndices
 const gap=sorted.findIndex((n,i)=>i>0 && n>sorted[i-1]+1)
 const sections=gap<0?sorted:[...sorted.slice(gap),...sorted.slice(0,gap)]
 const vertex=(r:number,s:number)=>radials[r]*sc+sections[s]
 const lastR=radials.length-1,lastS=sections.length-1
 const axisX=radials.map(r=>original[r*sc*3])
 const axisZ=sections.map(s=>original[s*3+2])
 const spanX=axisX.at(-1)!-axisX[0],spanZ=axisZ.at(-1)!-axisZ[0]
 // The source collar is identical in every mode: a coarse source zipper can
 // overlap itself even before a heightfield is applied to an extreme profile.
 const nx=384
 const nz=Math.max(48,Math.round(nx*spanZ/spanX))
 let position:number[]=Array.from(original),indices:number[]=[]
 const crownVertices=new Set(radials.flatMap(r=>sections.map(s=>r*sc+s)))
 const ix=base.geometry.index!.array
 for(let i=0;i<ix.length;i+=3) {
  if(crownVertices.has(ix[i])&&crownVertices.has(ix[i+1])&&crownVertices.has(ix[i+2]))continue
  indices.push(ix[i],ix[i+1],ix[i+2])
 }
 let crownStart=indices.length
 const grid:number[][]=[]
 const top=base.geometry.boundingBox!.max.y
 const sampleBase=(u:number,v:number,values:ArrayLike<number>)=>{
  const r=locate(axisX,u),s=locate(axisZ,v),r0=Math.floor(r),s0=Math.floor(s)
  const a=vertex(r0,s0),b=vertex(Math.min(lastR,r0+1),s0),c=vertex(r0,Math.min(lastS,s0+1)),d=vertex(Math.min(lastR,r0+1),Math.min(lastS,s0+1))
  const fr=r-r0,fs=s-s0
  return [0,1,2].map(k=>values[a*3+k]*(1-fr)*(1-fs)+values[b*3+k]*fr*(1-fs)+values[c*3+k]*(1-fr)*fs+values[d*3+k]*fr*fs)
 }
 // A square geographic crop is centred, never stretched onto a rectangular face.
 const footprint=Math.max(spanX,spanZ)
 for(let r=1;r<nx;r++) {
  const row:number[]=[];grid.push(row)
  for(let s=1;s<nz;s++) {
   const u=r/nx,v=s/nz,p=sampleBase(u,v,original),id=position.length/3
   row.push(id);position.push(...p)
   sourceNormals.push(...sampleBase(u,v,originalNormals))
  }
 }
 // Broad terrain and the base reduction share an affine upper stretch, joined
 // C2 to the protected lower body. Only fine terrain uses a short top collar.
 // Widen the lower join symmetrically around its previous centre. The upper
 // affine line stays EXACTLY the same; only a ~0.013 mm local shoulder turn
 // is redistributed so a narrow compression band cannot catch the reflection.
 const releaseY=Math.max(top-3.3,base.publicProps.innerDiameter/2+.5)
 const fullY=top
 const terrainReleaseY=top-1.25,terrainFullY=top-.05
 // Preserve the oriented parameter surface, including small overhangs at the bevel.
 const triangle=(a:number,b:number,c:number)=>{indices.push(a,b,c)}
 for(let r=0;r<grid.length-1;r++)for(let s=0;s<grid[0].length-1;s++) {
  const a=grid[r][s],b=grid[r][s+1],c=grid[r+1][s+1],d=grid[r+1][s]
  triangle(a,b,c);triangle(a,c,d)
 }
 // Zipper annulus: body boundary vertices are SHARED, so no duplicate seam or T-junction.
 const outer:{id:number,t:number}[]=[],inner:{id:number,t:number}[]=[]
 for(let s=0;s<lastS;s++)outer.push({id:vertex(0,s),t:(axisZ[s]-axisZ[0])/spanZ})
 for(let r=0;r<lastR;r++)outer.push({id:vertex(r,lastS),t:1+(axisX[r]-axisX[0])/spanX})
 for(let s=lastS;s>0;s--)outer.push({id:vertex(lastR,s),t:2+(axisZ.at(-1)!-axisZ[s])/spanZ})
 for(let r=lastR;r>0;r--)outer.push({id:vertex(r,0),t:3+(axisX.at(-1)!-axisX[r])/spanX})
 const ir=grid.length-1,is=grid[0].length-1
 for(let s=0;s<is;s++)inner.push({id:grid[0][s],t:s/is})
 for(let r=0;r<ir;r++)inner.push({id:grid[r][is],t:1+r/ir})
 for(let s=is;s>0;s--)inner.push({id:grid[ir][s],t:2+(is-s)/is})
 for(let r=ir;r>0;r--)inner.push({id:grid[r][0],t:3+(ir-r)/ir})
 outer.push({id:outer[0].id,t:4});inner.push({id:inner[0].id,t:4})
 let a=0,b=0
 while(a<outer.length-1||b<inner.length-1) {
  if(a<outer.length-1&&(b===inner.length-1||outer[a+1].t<=inner[b+1].t)) {triangle(outer[a].id,outer[++a].id,inner[b].id)}
  else {triangle(outer[a].id,inner[++b].id,inner[b-1].id)}
 }
 // Sparse side triangles can cross a finely sampled collar after a nonlinear
 // warp. Split their SOURCE edges conformingly, then evaluate the same field.
 const refined=refineReliefTransition({positions:position,normals:sourceNormals,indices,bodyIndexCount:crownStart,
  // The shared sides need the same safety resolution even in a quick preview.
  releaseY,maxEdgeLength:.1})
 position=refined.positions;indices=refined.indices;crownStart=refined.bodyIndexCount
 // The visible crown includes the upper bevel. An inset normalization mask
 // saturates lower/higher elevations along its edges into artificial flat strips.
 // Include every referenced top vertex, not the removed old crown interior.
 const normalizationVertices=Array.from(new Set(indices)).filter(id=>position[id*3+1]>=top-.1)
 const macroBounds={xMin:Infinity,xMax:-Infinity,zMin:Infinity,zMax:-Infinity}
 for(let i=0;i<position.length;i+=3)if(position[i+1]>releaseY) {
  macroBounds.xMin=Math.min(macroBounds.xMin,position[i]);macroBounds.xMax=Math.max(macroBounds.xMax,position[i])
  macroBounds.zMin=Math.min(macroBounds.zMin,position[i+2]);macroBounds.zMax=Math.max(macroBounds.zMax,position[i+2])
 }
 const bodyVertices=new Set(indices.slice(0,crownStart))
 const seamVertices=new Set(indices.slice(crownStart).filter(id=>bodyVertices.has(id)))
 base.geometry.dispose()
 return {positions:Float64Array.from(position),normals:Float64Array.from(sourceNormals),indices:Uint32Array.from(indices),crownStart,seamVertices,
  normalizationVertices,macroBounds,footprint,releaseY,fullY,terrainReleaseY,terrainFullY,grid:[nx,nz],reliefVertexCount:(nx-1)*(nz-1)}
}

export function buildAcceptedReliefModel(options:AcceptedReliefOptions) {
 const normalized=normalizeAcceptedMountainRingOptions(options)
 const key=JSON.stringify(normalized)
 let source=sourceCache.get(key)
 if(!source) {
  source=buildReliefSource(normalized)
  sourceCache.set(key,source)
  if(sourceCache.size>2)sourceCache.delete(sourceCache.keys().next().value!)
 }
 const {positions:sourcePosition,normals:sourceNormal,indices,crownStart,seamVertices,footprint,releaseY,fullY,terrainReleaseY,terrainFullY}=source
 const position=new Float32Array(sourcePosition)
 const normals=new Float32Array(sourceNormal.length)
 const fine=options.fine,view=options.view??fine.frame
 const direct=(u:number,v:number)=>sampleTerrainElevation(fine,options.coarse,view,u,v)
 const detail=options.detail??'high'
 // Полоса пропускания рельефа в предпросмотре. Сетка кольца — 384 узла,
 // так что 255 ещё не упирается в неё, а стоит лишь лишних вызовов direct.
 const divisions=detail==='low'?127:255
 // Separate numeric axes retain signed/outside-crop nodes without allocating a
 // string for every gradient probe. The cache belongs to this terrain build.
 const nodeCache=new Map<number,Map<number,number>>()
 const node=(x:number,y:number)=>{
  let row=nodeCache.get(y)
  if(row===undefined){row=new Map<number,number>();nodeCache.set(y,row)}
  let result=row.get(x)
  if(result===undefined){result=direct(x/divisions,y/divisions);row.set(x,result)}
  return result
 }
 // Detail changes the bandwidth of the real DEM, not the connecting topology.
 // High uses the original full-resolution sampling unchanged. Preview nodes
 // extend beyond [0,1] where needed, so upper sides don't get a new clamp rim.
 //
 // Узловая сетка берётся бикубикой, а не линейно. У линейной интерполяции
 // градиент постоянен внутри ячейки и скачет на её границе: высота
 // непрерывна, нормаль — нет. На полировке нормаль задаёт блик, поэтому
 // сетка узлов проступала квадратными гранями. Catmull-Rom непрерывна по
 // производной, огранка исчезает.
 const sample=(u:number,v:number)=>{
  if(detail==='high')return direct(u,v)
  const x=u*divisions,y=v*divisions,ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy
  const row=(o:number)=>cubic(node(ix-1,iy+o),node(ix,iy+o),node(ix+1,iy+o),node(ix+2,iy+o),dx)
  return cubic(row(-1),row(0),row(1),row(2),dy)
 }
 const elevationAt=(id:number)=>sample(.5+sourcePosition[id*3]/footprint,.5-sourcePosition[id*3+2]/footprint)
 const elevations=new Float64Array(position.length/3).fill(NaN)
 let minElevation=Infinity,maxElevation=-Infinity
 for(const id of source.normalizationVertices) {
  const elevation=elevationAt(id);elevations[id]=elevation
  minElevation=Math.min(minElevation,elevation);maxElevation=Math.max(maxElevation,elevation)
 }
 const amplitude=.3+2.7*clamp(options.relief??.5),range=maxElevation-minElevation
 const terrainHeight=(u:number,v:number)=>range>1e-6?clamp((sample(u,v)-minElevation)/range)*amplitude:0
 const macroAt=range>1e-6?buildReliefMacroField({
  heightAt:(x,z)=>terrainHeight(.5+x/footprint,.5-z/footprint),bounds:source.macroBounds,step:footprint/128
 }):()=>0
 // One source-grid cell across both probes: enough to resolve the actual mesh's
 // terrain without introducing the coarse body triangles into its reflection.
 const probe=.5/source.grid[0],probeDistance=2*probe*footprint
 const joinWidth=1.2,bodyScale=fullY-releaseY-joinWidth/2
 const terrainDepth=terrainFullY-terrainReleaseY
 let maximumLift=0,boundaryMaximumLift=0
 for(let id=0;id<position.length/3;id++) {
  const y=sourcePosition[id*3+1]
  let nx=sourceNormal[id*3],ny=sourceNormal[id*3+1],nz=sourceNormal[id*3+2]
  if(y>releaseY) {
   const elevation=Number.isNaN(elevations[id])?elevationAt(id):elevations[id]
   const t=clamp((y-releaseY)/joinWidth)
   const weight=y<releaseY+joinWidth
    ?joinWidth/bodyScale*(t**6-3*t**5+2.5*t**4)
    :(y-releaseY-joinWidth/2)/bodyScale
   const terrainT=clamp((y-terrainReleaseY)/terrainDepth),terrainWeight=smooth(terrainT)
   const loweredY=y-crownBaseReduction*weight
   const height=range>1e-6?clamp((elevation-minElevation)/range)*amplitude:0
   const x=sourcePosition[id*3],z=sourcePosition[id*3+2]
   const macro=macroAt(x,z,height),detailHeight=height-macro
   const lift=macro*weight+detailHeight*terrainWeight
   position[id*3+1]=loweredY+lift;maximumLift=Math.max(maximumLift,lift)
   if(seamVertices.has(id))boundaryMaximumLift=Math.max(boundaryMaximumLift,position[id*3+1]-Math.fround(loweredY))
   // Transport accepted normals through Y'=Y+(M-reduction)*wBody+(H-M)*wFine.
   // M<=H makes both terrain terms nonnegative and the vertical Jacobian >0.
   const derivative=smooth(t)/bodyScale
   const terrainDerivative=30*terrainT*terrainT*(1-terrainT)*(1-terrainT)/terrainDepth
   ny/=1+(macro-crownBaseReduction)*derivative+detailHeight*terrainDerivative
   if(range>1e-6) {
    const u=.5+x/footprint,v=.5-z/footprint,offset=probe*footprint
    const hx0=terrainHeight(u-probe,v),hx1=terrainHeight(u+probe,v)
    const hz0=terrainHeight(u,v+probe),hz1=terrainHeight(u,v-probe)
    const dx=(hx1-hx0)/probeDistance,dz=(hz1-hz0)/probeDistance
    const mx=(macroAt(x+offset,z,hx1)-macroAt(x-offset,z,hx0))/probeDistance
    const mz=(macroAt(x,z+offset,hz1)-macroAt(x,z-offset,hz0))/probeDistance
    nx-=(terrainWeight*dx+(weight-terrainWeight)*mx)*ny
    nz-=(terrainWeight*dz+(weight-terrainWeight)*mz)*ny
   }
  }
  const length=Math.hypot(nx,ny,nz)||1
  normals[id*3]=nx/length;normals[id*3+1]=ny/length;normals[id*3+2]=nz/length
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(position,3))
 geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
 geometry.setIndex(new THREE.BufferAttribute(indices.slice(),1))
 geometry.addGroup(0,crownStart,0)
 geometry.addGroup(crownStart,indices.length-crownStart,1)
 geometry.computeBoundingBox();geometry.computeBoundingSphere()
 return {geometry,stats:{reliefVertexCount:source.reliefVertexCount,maximumLift,boundaryMaximumLift,
  grid:source.grid.slice(),minElevation,maxElevation}}
}
