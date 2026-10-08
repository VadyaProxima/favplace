export type ReliefTransitionInput = {
 positions: number[]
 normals?: number[]
 indices: number[]
 bodyIndexCount: number
 releaseY: number
 maxEdgeLength: number
}

/**
 * Refine the undeformed transition before evaluating its nonlinear terrain warp.
 * Appends source-space midpoints to positions, preserving every original ID.
 * Every incident triangle uses the same midpoint; material groups stay contiguous.
 * Six rounds bound the work even for accidentally oversized source triangles.
 */
export function refineReliefTransition({positions,normals,indices,bodyIndexCount,releaseY,maxEdgeLength}:ReliefTransitionInput) {
 if(!(maxEdgeLength>0) || !Number.isFinite(maxEdgeLength))throw new Error('Relief transition edge length must be finite and positive')
 const maximumSquared=maxEdgeLength*maxEdgeLength
 let refinementRounds=0
 for(let round=0;round<6;round++) {
  const vertexCount=positions.length/3
  const key=(a:number,b:number)=>Math.min(a,b)*vertexCount+Math.max(a,b)
  const midpoints=new Map<number,number>()
  for(let i=0;i<indices.length;i+=3)for(let edge=0;edge<3;edge++) {
   const a=indices[i+edge],b=indices[i+(edge+1)%3],edgeKey=key(a,b)
   if(midpoints.has(edgeKey))continue
   if(Math.max(positions[a*3+1],positions[b*3+1])<=releaseY)continue
   const dx=positions[a*3]-positions[b*3],dy=positions[a*3+1]-positions[b*3+1],dz=positions[a*3+2]-positions[b*3+2]
   if(dx*dx+dy*dy+dz*dz<=maximumSquared*(1+1e-12))continue
   const midpoint=positions.length/3
   positions.push((positions[a*3]+positions[b*3])/2,(positions[a*3+1]+positions[b*3+1])/2,(positions[a*3+2]+positions[b*3+2])/2)
   // Preserve the original smooth field. Normalizing intermediate values would
   // change barycentric interpolation after another subdivision round.
   if(normals)normals.push((normals[a*3]+normals[b*3])/2,(normals[a*3+1]+normals[b*3+1])/2,(normals[a*3+2]+normals[b*3+2])/2)
   midpoints.set(edgeKey,midpoint)
  }
  if(midpoints.size===0)break
  const next:number[]=[]
  let nextBodyIndexCount=0
  for(let i=0;i<indices.length;i+=3) {
   const a=indices[i],b=indices[i+1],c=indices[i+2]
   const ab=midpoints.get(key(a,b)),bc=midpoints.get(key(b,c)),ca=midpoints.get(key(c,a))
   const marked=Number(ab!==undefined)+Number(bc!==undefined)+Number(ca!==undefined)
   if(marked===0)next.push(a,b,c)
   else if(marked===3)next.push(a,ab!,ca!, ab!,b,bc!, ca!,bc!,c, ab!,bc!,ca!)
   else {
    const vertices=[a,b,c],edges=[ab,bc,ca]
    // Rotate the triangle so a single marked edge is AB, or two are AB/BC.
    const start=marked===1?edges.findIndex(n=>n!==undefined):(edges.findIndex(n=>n===undefined)+1)%3
    const x=vertices[start],y=vertices[(start+1)%3],z=vertices[(start+2)%3],xy=edges[start]!
    if(marked===1)next.push(x,xy,z, xy,y,z)
    else {
     const yz=edges[(start+1)%3]!
     const distanceSquared=(a:number,b:number)=>{
      const dx=positions[a*3]-positions[b*3],dy=positions[a*3+1]-positions[b*3+1],dz=positions[a*3+2]-positions[b*3+2]
      return dx*dx+dy*dy+dz*dz
     }
     next.push(y,yz,xy)
     if(distanceSquared(xy,z)<=distanceSquared(x,yz))next.push(x,xy,z, xy,yz,z)
     else next.push(x,xy,yz, x,yz,z)
    }
   }
   if(i<bodyIndexCount)nextBodyIndexCount=next.length
  }
  indices=next;bodyIndexCount=nextBodyIndexCount;refinementRounds++
 }
 let maximumRemainingActiveEdgeLength=0
 for(let i=0;i<indices.length;i+=3)for(let edge=0;edge<3;edge++) {
  const a=indices[i+edge],b=indices[i+(edge+1)%3]
  if(Math.max(positions[a*3+1],positions[b*3+1])<=releaseY)continue
  const dx=positions[a*3]-positions[b*3],dy=positions[a*3+1]-positions[b*3+1],dz=positions[a*3+2]-positions[b*3+2]
  maximumRemainingActiveEdgeLength=Math.max(maximumRemainingActiveEdgeLength,dx*dx+dy*dy+dz*dz)
 }
 return {positions,normals,indices,bodyIndexCount,refinementRounds,maximumRemainingActiveEdgeLength:Math.sqrt(maximumRemainingActiveEdgeLength)}
}
