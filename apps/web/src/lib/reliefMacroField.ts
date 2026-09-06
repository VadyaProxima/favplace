export type ReliefMacroFieldOptions = {
 heightAt:(x:number,z:number)=>number
 bounds:{xMin:number,xMax:number,zMin:number,zMax:number}
 step:number
}

/**
 * A nonnegative lower envelope for the broad body relief. The source is sampled
 * on a padded world-space grid, eroded by four nodes, then box-blurred by two.
 * Pointwise clamping also preserves valleys narrower than a grid cell.
 * An optional sourceHeight must be the heightAt result for this exact point;
 * callers that already sampled the DEM can reuse it without another lookup.
 */
export function buildReliefMacroField({heightAt,bounds,step}:ReliefMacroFieldOptions) {
 if(!(step>0)||!Number.isFinite(step))throw new Error('Relief macro step must be finite and positive')
 if(!Object.values(bounds).every(Number.isFinite)||bounds.xMin>bounds.xMax||bounds.zMin>bounds.zMax)
  throw new Error('Relief macro bounds must be finite and ordered')
 const erosionRadius=4,blurRadius=2,padding=erosionRadius+blurRadius+2
 const firstX=Math.floor(bounds.xMin/step)-padding,firstZ=Math.floor(bounds.zMin/step)-padding
 const width=Math.ceil(bounds.xMax/step)-firstX+padding+1
 const height=Math.ceil(bounds.zMax/step)-firstZ+padding+1
 const sample=(x:number,z:number)=>{
  const value=heightAt(x,z)
  if(!Number.isFinite(value))throw new Error('Relief macro source heights must be finite')
  return Math.max(0,value)
 }
 const input=new Float64Array(width*height)
 for(let z=0;z<height;z++)for(let x=0;x<width;x++)input[z*width+x]=sample((firstX+x)*step,(firstZ+z)*step)
 // Fixed small kernels keep this linear in grid size, without sparse arrays or
 // coordinate-packing assumptions. Padding keeps temporary edge handling away
 // from every requested bound and its neighboring gradient probes.
 const pass=(values:Float64Array,radius:number,horizontal:boolean,minimum:boolean)=>{
  const result=new Float64Array(values.length)
  for(let z=0;z<height;z++)for(let x=0;x<width;x++){
   let value=minimum?Infinity:0
   for(let offset=-radius;offset<=radius;offset++){
    const sx=horizontal?Math.max(0,Math.min(width-1,x+offset)):x
    const sz=horizontal?z:Math.max(0,Math.min(height-1,z+offset))
    const next=values[sz*width+sx]
    value=minimum?Math.min(value,next):value+next
   }
   result[z*width+x]=minimum?value:value/(2*radius+1)
  }
  return result
 }
 const eroded=pass(pass(input,erosionRadius,true,true),erosionRadius,false,true)
 const blurred=pass(pass(eroded,blurRadius,true,false),blurRadius,false,false)
 const interior=(x:number,z:number,margin:number)=>x>=margin&&z>=margin&&x<width-margin&&z<height-margin
 const erodedAt=(x:number,z:number)=>{
  if(interior(x,z,erosionRadius))return eroded[z*width+x]
  let value=Infinity
  for(let dz=-erosionRadius;dz<=erosionRadius;dz++)for(let dx=-erosionRadius;dx<=erosionRadius;dx++)
   value=Math.min(value,sample((firstX+x+dx)*step,(firstZ+z+dz)*step))
  return value
 }
 // Queries beyond the padded buffer use the same filter instead of repeating
 // its boundary value. The bounded mesh and normal probes stay on the fast path.
 const outsideRows=new Map<number,Map<number,number>>()
 const node=(x:number,z:number)=>{
  if(interior(x,z,erosionRadius+blurRadius))return blurred[z*width+x]
  let row=outsideRows.get(z)
  if(row===undefined){row=new Map<number,number>();outsideRows.set(z,row)}
  let value=row.get(x)
  if(value===undefined){
   value=0
   for(let dz=-blurRadius;dz<=blurRadius;dz++){
    let horizontal=0
    for(let dx=-blurRadius;dx<=blurRadius;dx++)horizontal+=erodedAt(x+dx,z+dz)
    value+=horizontal/(2*blurRadius+1)
   }
   value/=2*blurRadius+1
   row.set(x,value)
  }
  return value
 }
 return (x:number,z:number,sourceHeight?:number)=>{
  const gx=x/step-firstX,gz=z/step-firstZ,ix=Math.floor(gx),iz=Math.floor(gz),dx=gx-ix,dz=gz-iz
  const macro=(node(ix,iz)*(1-dx)+node(ix+1,iz)*dx)*(1-dz)
   +(node(ix,iz+1)*(1-dx)+node(ix+1,iz+1)*dx)*dz
  return Math.min(Math.max(0,sourceHeight??sample(x,z)),Math.max(0,macro))
 }
}
