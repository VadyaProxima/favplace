import * as THREE from 'three'
import { buildAcceptedMountainRing, normalizeAcceptedMountainRingOptions, type AcceptedMountainRingOptions } from './acceptedMountainRing.ts'
import type { TerrainFrame, TerrainGeoFrame } from './referenceSignetTerrain.ts'
import { refineReliefTransition } from './refineReliefTransition.ts'
import { buildReliefMacroField } from './reliefMacroField.ts'

/** Independently authored crown remeshing, 2026-09-05. No reference-body deformation. */
/** Источник высот: мелкий кадр, широкий контекст и рамка просмотра. */
export interface TerrainSource {
 fine: TerrainFrame
 coarse?: TerrainFrame | null
 view?: TerrainGeoFrame | null
}

export type AcceptedReliefOptions = AcceptedMountainRingOptions & {
 fine: TerrainFrame
 coarse?: TerrainFrame | null
 view?: TerrainGeoFrame | null
 /**
  * Вторая местность по краям площадки, со стороны скосов. Основная занимает
  * центр, эта — две полосы у длинных краёв, между ними плавный переход.
  */
 edge?: TerrainSource | null
 /**
  * Доля полуширины площадки, с которой начинается вторая местность:
  * 0 — сразу от центра, 1 — только у самой кромки.
  */
 edgeStart?: number
 relief?: number
 detail?: 'low' | 'medium' | 'high'
 /** A smaller crown for live map motion. Export always uses the full mesh. */
 preview?: boolean
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

/** Ширина сетки короны: с ней сравнивается разрешение кадра. */
const CROWN_GRID=384

export function sampleElevation(f:TerrainFrame,u:number,v:number) {
 const x=clamp(u)*(f.size-1),y=(1-clamp(v))*(f.size-1)
 const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy
 const last=f.size-1
 // Бикубика нужна только при увеличении. Промежуточные ступени приходят
 // сеткой 256 на меш из 384 узлов — там линейная интерполяция рвёт градиент
 // и даёт грани. Финальный кадр 1024 наоборот уменьшается, и бикубика в нём
 // ничего не даёт, зато стоит вчетверо больше выборок: 270 мс против 167 мс
 // на построение рельефа.
 if(f.size<CROWN_GRID) {
  const at=(cx:number,cy:number)=>
   f.data[Math.min(Math.max(cy,0),last)][Math.min(Math.max(cx,0),last)]
  const row=(o:number)=>cubic(at(ix-1,iy+o),at(ix,iy+o),at(ix+1,iy+o),at(ix+2,iy+o),dx)
  return f.minElev+cubic(row(-1),row(0),row(1),row(2),dy)*(f.maxElev-f.minElev)
 }
 const rowA=f.data[iy],rowB=f.data[Math.min(iy+1,last)]
 const a=rowA[ix]*(1-dx)+rowA[Math.min(ix+1,last)]*dx
 const b=rowB[ix]*(1-dx)+rowB[Math.min(ix+1,last)]*dx
 return f.minElev+(a*(1-dy)+b*dy)*(f.maxElev-f.minElev)
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

/** Compute geographic transforms once per frame, rather than once per vertex/probe. */
function terrainSampler(fine:TerrainFrame,coarse:TerrainFrame|null|undefined,view:TerrainGeoFrame) {
 const angle=-view.bearing*Math.PI/180
 const cos=Math.cos(angle),sin=Math.sin(angle),diameter=2*view.radiusKm
 const prepare=(source:TerrainFrame)=>{
  const inv=source.frame.bearing*Math.PI/180,sourceCos=Math.cos(inv),sourceSin=Math.sin(inv)
  const eastOffset=(view.lng-source.frame.lng)*111.32*Math.cos(source.frame.lat*Math.PI/180)
  const northOffset=(view.lat-source.frame.lat)*111.32,sourceDiameter=2*source.frame.radiusKm
  return (u:number,v:number)=>{
   const x=(u-.5)*diameter,y=(v-.5)*diameter
   const east=x*cos-y*sin+eastOffset,north=x*sin+y*cos+northOffset
   const su=.5+(east*sourceCos-north*sourceSin)/sourceDiameter
   const sv=.5+(east*sourceSin+north*sourceCos)/sourceDiameter
   return {u:su,v:sv,margin:Math.min(su,1-su,sv,1-sv)}
  }
 }
 const fineUv=prepare(fine),coarseUv=coarse?prepare(coarse):null
 return (u:number,v:number)=>{
  const uv=fineUv(u,v)
  if(uv.margin>=.04||!coarse||!coarseUv)return sampleElevation(fine,uv.u,uv.v)
  const context=coarseUv(u,v)
  if(context.margin<0)return sampleElevation(fine,uv.u,uv.v)
  const elevation=sampleElevation(coarse,context.u,context.v)
  if(uv.margin<=0)return elevation
  const weight=smooth(uv.margin/.04)
  return sampleElevation(fine,uv.u,uv.v)*weight+elevation*(1-weight)
 }
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

function buildReliefSource(options:AcceptedMountainRingOptions,nx=384):ReliefSource {
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
 //
 // Габарит берётся по самой площадке, а не по осям короны. Оси считаются по
 // одному ряду вершин и заметно короче плоского верха: при расширенной
 // площадке край выходил за мелкую карту, sampleTerrainElevation подхватывал
 // там грубый кадр (радиус ×8, разрешение 256), и по бокам появлялись полосы
 // с другим рельефом и резкой границей. Замер до правки: верх тянулся на
 // ±6.55 мм по X при половине габарита ±5.08, то есть 28% вершин уходили за
 // карту.
 let faceHalfSpan=0
 for(let i=0;i<original.length;i+=3) {
  if(original[i+1]<top-.1)continue
  faceHalfSpan=Math.max(faceHalfSpan,Math.abs(original[i]),Math.abs(original[i+2]))
 }
 const footprint=Math.max(spanX,spanZ,2*faceHalfSpan)
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
 // Полоса гашения мелкой детали — доля глубины короны, а не фиксированные
 // миллиметры. Подъём считается как macro*weight + detail*terrainWeight, и
 // terrainWeight гаснет именно на этой полосе. У принятой базы корона 3.3 мм
 // и 1.25 мм занимали её треть. При опущенной площадке корона всего 2 мм —
 // те же миллиметры съедали больше половины, и мелкий рельеф исчезал задолго
 // до края площадки. Заметно это на ровной местности: там почти весь сигнал
 // и есть detail, тогда как у горы основная форма уходит в macro, который
 // гаснет медленнее, — поэтому на высоком рельефе дефект не виден.
 const terrainReleaseY=top-Math.min(1.25,(top-releaseY)*.38),terrainFullY=top-.05
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
 const gridSegments=options.preview?96:384
 const key=JSON.stringify([normalized,gridSegments])
 let source=sourceCache.get(key)
 if(!source) {
  source=buildReliefSource(normalized,gridSegments)
  sourceCache.set(key,source)
  if(sourceCache.size>4)sourceCache.delete(sourceCache.keys().next().value!)
 }
 const {positions:sourcePosition,normals:sourceNormal,indices,crownStart,seamVertices,footprint,releaseY,fullY,terrainReleaseY,terrainFullY}=source
 const position=new Float32Array(sourcePosition)
 const normals=new Float32Array(sourceNormal.length)
 const fine=options.fine,view=options.view??fine.frame
 const directMain=terrainSampler(fine,options.coarse,view)

 // Вторая местность по краям площадки.
 //
 // Нормировать обе одним диапазоном нельзя: если в центре гора 5600 м, а по
 // краям что-то на 200 м, общий размах растянется на 5400 м и обе станут
 // плоскими. Поэтому у каждой свой размах, снятый по её же части площадки,
 // и смешиваются уже нормированные значения.
 const edge=options.edge??null
 const edgeSource=edge?edge.fine:null
 const edgeView=edge?edge.view??edge.fine.frame:null
 const directEdge=edge&&edgeSource&&edgeView
  ?terrainSampler(edgeSource,edge.coarse,edgeView)
  :null
 // 0 в центре площадки, 1 у длинного края со стороны скосов.
 const edgeStart=clamp(options.edgeStart??.55,.2,.95)
 const edgeWeight=directEdge
  ?(u:number)=>smooth((Math.abs(u-.5)*2-edgeStart)/(1-edgeStart))
  :()=>0

 // Размах каждой местности снимается по тем вершинам, где она преобладает.
 let minMain=Infinity,maxMain=-Infinity,minEdge=Infinity,maxEdge=-Infinity
 for(const id of source.normalizationVertices) {
  const u=.5+sourcePosition[id*3]/footprint,v=.5-sourcePosition[id*3+2]/footprint
  const w=edgeWeight(u)
  if(w<1) {
   const e=directMain(u,v)
   if(e<minMain)minMain=e
   if(e>maxMain)maxMain=e
  }
  if(w>0&&directEdge) {
   const e=directEdge(u,v)
   if(e<minEdge)minEdge=e
   if(e>maxEdge)maxEdge=e
  }
 }
 const rangeMain=maxMain-minMain,rangeEdge=maxEdge-minEdge

 /** Нормированная высота 0..1: каждая местность по своему размаху. */
 const direct=(u:number,v:number)=>{
  const main=rangeMain>1e-6?clamp((directMain(u,v)-minMain)/rangeMain):0
  if(!directEdge)return main
  const w=edgeWeight(u)
  if(w<=0)return main
  const other=rangeEdge>1e-6?clamp((directEdge(u,v)-minEdge)/rangeEdge):0
  return w>=1?other:main*(1-w)+other*w
 }
 const detail=options.preview?'high':options.detail??'high'
 // Полоса пропускания рельефа в предпросмотре. Сетка кольца — 384 узла,
 // так что 255 ещё не упирается в неё, а стоит лишь лишних вызовов direct.
 const divisions=detail==='low'?127:255
 // Кэш узлов — плоский типизированный массив, а не вложенные Map. На вершину
 // приходится двадцать обращений к узлам (центр и четыре пробы, по четыре
 // отсчёта Catmull-Rom), на всю корону это миллионы обращений: хеш-таблицы с
 // упакованными числами были здесь основной статьёй расхода. Индексы узлов
 // выходят за [0, divisions] — пробы и стенсиль смотрят наружу, — поэтому по
 // краям заложен запас.
 const nodeMargin=4
 const nodeStride=divisions+1+2*nodeMargin
 const nodeValues=new Float64Array(nodeStride*nodeStride)
 const nodeReady=new Uint8Array(nodeStride*nodeStride)
 const node=(x:number,y:number)=>{
  const cx=x+nodeMargin,cy=y+nodeMargin
  // За пределами запаса кэш не держим: такие узлы единичны.
  if(cx<0||cy<0||cx>=nodeStride||cy>=nodeStride)return direct(x/divisions,y/divisions)
  const index=cy*nodeStride+cx
  if(nodeReady[index]===0) {
   nodeValues[index]=direct(x/divisions,y/divisions)
   nodeReady[index]=1
  }
  return nodeValues[index]
 }
 // Detail changes the bandwidth of the real DEM, not the connecting topology.
 // Preview nodes extend beyond [0,1] where needed, so upper sides don't get
 // a new clamp rim.
 //
 // Узловая сетка берётся бикубикой, а не линейно. У линейной интерполяции
 // градиент постоянен внутри ячейки и скачет на её границе: высота
 // непрерывна, нормаль — нет. На полировке нормаль задаёт блик, поэтому
 // сетка узлов проступала квадратными гранями. Catmull-Rom непрерывна по
 // производной, огранка исчезает.
 //
 // High раньше читал кадр напрямую. Это и давало парадокс: на финальной
 // ступени, где данных больше всего, квадраты появлялись, а на предыдущей
 // их не было. Узлов меша 384, а финальный кадр приходит сеткой 1024 —
 // читать его точечно значит недосэмплировать и получать алиасинг.
 // Грубые ступени этим не страдали: узловая сетка работала фильтром
 // низких частот. Усредняем по площадке, которую занимает узел меша.
 // Префильтр 2x2 на detail=high убран: замер показал выигрыш по дрожанию
 // всего 2-6%, а стоил он учетверения выборок — 784 мс против 270 мс на
 // построение рельефа. Финальный кадр приходит сеткой 1024 на меш из 384
 // узлов, то есть идёт уменьшение, и недосэмплирование там несущественно.
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
 // Ширина стыка привязана к высоте короны, а не задана намертво. У принятой
 // базы над отверстием почти 4 мм и на стык хватало фиксированных 1.2 мм.
 // Если FACE_HEIGHT опустить, releaseY упирается в защиту отверстия, зазор
 // до верха становится меньше самого стыка, и bodyScale схлопывается почти
 // в ноль — переход рельефа сжимается, вершина выглядит срезанной.
 const crownSpan=fullY-releaseY
 const joinWidth=Math.min(1.2,crownSpan*.5)
 const bodyScale=Math.max(crownSpan-joinWidth/2,1e-3)
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
   if(options.preview)continue
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
  if(options.preview)continue
  const length=Math.hypot(nx,ny,nz)||1
  normals[id*3]=nx/length;normals[id*3+1]=ny/length;normals[id*3+2]=nz/length
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(position,3))
 geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3))
 geometry.setIndex(new THREE.BufferAttribute(indices.slice(),1))
 if(options.preview) {
  // The small live mesh already samples the shape: derive its normals in one
  // triangle pass instead of four extra DEM/gradient probes per upper vertex.
  geometry.computeVertexNormals()
  for(let id=0;id<position.length/3;id++)if(sourcePosition[id*3+1]<=releaseY) {
   const nx=sourceNormal[id*3],ny=sourceNormal[id*3+1],nz=sourceNormal[id*3+2]
   const length=Math.hypot(nx,ny,nz)||1
   normals[id*3]=nx/length;normals[id*3+1]=ny/length;normals[id*3+2]=nz/length
  }
 }
 geometry.addGroup(0,crownStart,0)
 geometry.addGroup(crownStart,indices.length-crownStart,1)
 geometry.computeBoundingBox();geometry.computeBoundingSphere()
 return {geometry,stats:{reliefVertexCount:source.reliefVertexCount,maximumLift,boundaryMaximumLift,
  grid:source.grid.slice(),minElevation,maxElevation}}
}
