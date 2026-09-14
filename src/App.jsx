import React, { useState, useRef, useEffect } from 'react'
import Peer from 'peerjs'

export default function App(){
  const [role,setRole]=useState(localStorage.getItem('cami-role')||null)
  const vRef=useRef(null)
  const peerRef=useRef(null)
  const [cams,setCams]=useState({})

  useEffect(()=>{
    if(!role) return
    const peer=new Peer('cami-'+role+'-'+Math.random().toString(36).slice(2,5),{
      config:{iceServers:[{urls:"stun:stun.l.google.com:19302"}]}
    })
    peerRef.current=peer
    if(role==='camera'){
      peer.on('connection',c=>{
        c.on('data',async d=>{
          if(d.type==='go'){
            const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true})
            peer.call(c.peer,s)
          }
        })
      })
    } else {
      peer.on('call',call=>{
        call.answer()
        call.on('stream',s=>{
          if(vRef.current) vRef.current.srcObject=s
        })
      })
    }
  },[role])

  if(!role){
    return (
      <div style={{padding:20,background:'#000',color:'#fff',minHeight:'100vh'}}>
        <h1>Cami</h1>
        <button onClick={()=>{localStorage.setItem('cami-role','camera');location.reload()}}>Mode Camera</button>
        <button onClick={()=>{localStorage.setItem('cami-role','viewer');location.reload()}}>Mode Viewer</button>
      </div>
    )
  }

  if(role==='camera'){
    return <div style={{background:'#000',color:'#555',minHeight:'100vh',display:'grid',placeItems:'center'}}><p>Camera ON - LED active</p><button onClick={()=>{localStorage.clear();location.reload()}}>Reset</button></div>
  }

  return (
    <div style={{padding:16}}>
      <p>Viewer</p>
      <video ref={vRef} autoPlay playsInline style={{width:'100%',background:'#111',aspectRatio:'16/9'}} />
    </div>
  )
}
