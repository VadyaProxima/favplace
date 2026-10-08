import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAcceptedMountainRing, ACCEPTED_MOUNTAIN_DEFAULTS } from '../src/lib/acceptedMountainRing.ts'
import { validateAcceptedMountainRing } from '../src/lib/acceptedMountainRingValidation.ts'
import { buildAcceptedReliefModel } from '../src/lib/acceptedMountainRelief.ts'

test('expanded crown blends into the side without a forced flat step', () => {
 const model=buildAcceptedMountainRing(ACCEPTED_MOUNTAIN_DEFAULTS)
 const p=model.originalPositions
 // At the centre of the front/back edge, the former source-frame mismatch
 // held section13 flat and dropped section14 by .362 mm over .030 mm of Z.
 for(const sign of [1,-1]) {
  const section=n=>(sign===1?n:model.sectionCount-n)%model.sectionCount
  const drop=Math.abs(p[section(13)*3+1]-p[section(14)*3+1])
  assert.ok(drop<.15, `abrupt crown edge on side ${sign}: ${drop.toFixed(5)} mm`)
 }
 model.geometry.dispose()
})

test('upper sides do not flare outward below the crown seam in any preset', () => {
 let maximumOverhang=0
 for(const ringDiameter of [15,17,22])
 for(const mass of ['subtle','classic','statement'])
 for(const profile of ['flat','classic','d-shaped'])
 for(const shoulders of ['straight','classic','curved']) {
  const options={ringDiameter,mass,profile,shoulders}
  const model=buildAcceptedMountainRing(options),p=model.originalPositions
  const seam=Math.max(...model.sectionSurfaceIndices.filter(s=>s<model.sectionCount/2))
  for(const radial of model.faceRadialIndices)for(const sign of [1,-1]) {
   const section=n=>(sign===1?n:model.sectionCount-n)%model.sectionCount
   const z=s=>Math.abs(p[(radial*model.sectionCount+section(s))*3+2])
   const crownWidth=z(seam)
   for(let s=seam+1;s<=model.sectionCount/2;s++) {
    const overhang=z(s)-crownWidth
    maximumOverhang=Math.max(maximumOverhang,overhang)
    assert.ok(overhang<.05,`${JSON.stringify(options)} radial${radial} side${sign}: side protrudes ${overhang.toFixed(5)} mm`)
   }
   // Check both Z rails of every crown slice, not just the centre slice.
   for(let s=1;s<=seam;s++)assert.ok(z(s)>z(s-1),'folded crown sampling rail')
  }
  const report=validateAcceptedMountainRing(model)
  assert.equal(report.finite,true)
  assert.equal(report.boundaryEdges,0)
  assert.equal(report.nonManifoldEdges,0)
  assert.equal(report.degenerateTriangles,0)
  assert.ok(report.signedVolume>0)
  assert.ok(Math.abs(report.boreDiameter-ringDiameter)<.001)
  model.geometry.dispose()
 }
 console.log(`Maximum under-seam overhang across 81 presets: ${maximumOverhang.toFixed(5)} mm`)
})

test('terrain keeps the corrected sides, closed mesh and protected opening', () => {
 const size=65
 const frame={lat:35.3628,lng:138.7307,radiusKm:5,bearing:0}
 const fine={size,frame,minElev:0,maxElev:2000,final:true,data:Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>.5+.2*Math.sin(c*.31)*Math.cos(r*.27)+.15*Math.sin(c*.11+r*.17)))}
 for(const [ringDiameter,mass,profile,shoulders] of [
  [15,'subtle','flat','straight'],[15,'statement','d-shaped','curved'],
  [17,'classic','classic','classic'],[22,'subtle','classic','curved'],
  [22,'statement','flat','straight'],
 ]) {
  const options={ringDiameter,mass,profile,shoulders}
  const base=buildAcceptedMountainRing(options)
  const protectedY=Math.max(base.geometry.boundingBox.max.y-3.3,ringDiameter/2+.5)
  for(const detail of ['low','high'])for(const relief of [0,1]) {
   const result=buildAcceptedReliefModel({...options,fine,detail,relief})
   const geometry=result.geometry,p=geometry.attributes.position.array
   const report=validateAcceptedMountainRing({...base,geometry})
   assert.equal(report.finite,true)
   assert.equal(report.boundaryEdges,0)
   assert.equal(report.nonManifoldEdges,0)
   assert.equal(report.degenerateTriangles,0)
   assert.ok(report.signedVolume>0)
   assert.ok(Math.abs(report.boreDiameter-ringDiameter)<.001)
   for(let id=0;id<base.originalPositions.length/3;id++) {
    const offset=id*3,source=base.originalPositions
    assert.equal(p[offset],source[offset],'terrain must not widen corrected X')
    assert.equal(p[offset+2],source[offset+2],'terrain must not restore side ears')
    if(source[offset+1]<=protectedY)assert.equal(p[offset+1],source[offset+1],'terrain moved protected body')
   }
   assert.ok(result.stats.maximumLift>.1,'terrain disappeared')
   assert.ok(result.stats.maximumLift<=.3+2.7*relief+1e-5,'terrain exceeds requested amplitude')
   geometry.dispose()
  }
  base.geometry.dispose()
 }
})
