'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { AcceptedReliefOptions } from './acceptedMountainRelief'

/** One active job + one latest request. Map motion never builds an obsolete worker queue. */
export function useAcceptedRelief(options:AcceptedReliefOptions|null) {
 const [result,setResult]=useState<{geometry:THREE.BufferGeometry|null,error:string|null,busy:boolean}>({geometry:null,error:null,busy:false})
 const pending=useRef(options),serial=useRef(0),workerRef=useRef<Worker|null>(null)
 const busy=useRef(false),send=useRef(()=>{})
 const loadedFrames=useRef<{fine:unknown,coarse:unknown}>({fine:null,coarse:null})
 const lastGeometry=useRef<THREE.BufferGeometry|null>(null)
 useEffect(()=>{
  const worker=new Worker(new URL('./acceptedRelief.worker.ts',import.meta.url))
  workerRef.current=worker
  send.current=()=>{
   const next=pending.current
   if(busy.current||!next)return
   busy.current=true
   const {fine,coarse,...configuration}=next
   const changed=fine!==loadedFrames.current.fine||coarse!==loadedFrames.current.coarse
   loadedFrames.current={fine,coarse}
   worker.postMessage({id:serial.current,options:configuration,...(changed?{frames:{fine,coarse}}:{})})
   setResult(previous=>({...previous,busy:true}))
  }
  worker.onmessage=({data})=>{
   busy.current=false
   if(pending.current){
    if(data.error&&data.id===serial.current)setResult(previous=>({...previous,error:data.error,busy:false}))
    else if(!data.error) {
     const geometry=new THREE.BufferGeometry()
     geometry.setAttribute('position',new THREE.BufferAttribute(data.position,3))
     geometry.setAttribute('normal',new THREE.BufferAttribute(data.normal,3))
     geometry.setIndex(new THREE.BufferAttribute(data.index,1))
     for(const group of data.groups)geometry.addGroup(group.start,group.count,group.materialIndex)
     // The worker already scanned these buffers; avoid repeating that work on the UI thread.
     geometry.boundingBox=new THREE.Box3(new THREE.Vector3().fromArray(data.bounds.min),new THREE.Vector3().fromArray(data.bounds.max))
     geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3().fromArray(data.sphere.center),data.sphere.radius)
     const old=lastGeometry.current;lastGeometry.current=geometry
     // Show progressive frames during continuous motion, not only after the pointer stops.
     setResult({geometry,error:null,busy:data.id!==serial.current})
     // Leave one frame for React to replace the mesh before releasing its buffers.
     if(old)requestAnimationFrame(()=>old.dispose())
    }
   }
   if(data.id!==serial.current)send.current()
  }
  worker.onerror=()=>{busy.current=false;setResult(previous=>({...previous,busy:false,error:'Не удалось построить рельеф. Обновите страницу.'}))}
  return()=>{worker.terminate();workerRef.current=null;busy.current=false;loadedFrames.current={fine:null,coarse:null};lastGeometry.current?.dispose();lastGeometry.current=null}
 },[])
 useEffect(()=>{
  pending.current=options;serial.current++
  if(options)send.current()
  else {setResult({geometry:null,error:null,busy:false});lastGeometry.current?.dispose();lastGeometry.current=null}
 },[options])
 return result
}
