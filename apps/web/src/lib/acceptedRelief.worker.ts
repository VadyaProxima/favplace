import { buildAcceptedReliefModel, type AcceptedReliefOptions } from './acceptedMountainRelief.ts'
import type { TerrainFrame } from './referenceSignetTerrain.ts'

let fine:TerrainFrame|null=null,coarse:TerrainFrame|null=null
self.onmessage=(event:MessageEvent)=>{
 const {id,options,frames}=event.data
 if(frames){fine=frames.fine;coarse=frames.coarse}
 try {
  if(!fine)throw new Error('Нет данных высот')
  const model=buildAcceptedReliefModel({...options,fine,coarse} as AcceptedReliefOptions)
  const position=model.geometry.attributes.position.array
  const normal=model.geometry.attributes.normal.array
  const index=model.geometry.index!.array
  self.postMessage({id,position,normal,index,groups:model.geometry.groups,stats:model.stats},
   {transfer:[position.buffer,normal.buffer,index.buffer]})
  model.geometry.dispose()
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Ошибка построения рельефа'})}
}
