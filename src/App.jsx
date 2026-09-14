import React,{useEffect,useRef,useState} from 'react'
import Peer from 'peerjs'
export default function App(){
 const [role,setRole]=useState(localStorage.getItem('cami-role')||null)
 const peerRef=useRef(null); const vRef=useRef(null)
 const [cams,setCams]=useState({})
 useEffect(()=>{ if(!role)return; const p=new Peer('cami-'+role+'-'+Math.random().toString(36).slice(2,6),{config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"}]}}); peerRef.current=p; if(role==='camera'){ p.on('connection',c=>{c.on('data',async d=>{ if(d.type==='a'){ const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); p.call(c.peer,s) }})})} else { p.on('call',call=>{call.answer(); call.on('stream',s=>{ if(vRef.current)vRef.current.srcObject=s })}); (async()=>{ const {joinRoom}=await import('trystero/torrent'); const room=joinRoom({appId:'cami'},'cami-v1'); const [send,get]=room.makeAction('p'); get(d=>setCams(x=>({...x,[d.id]:d}))); setInterval(()=>{ if(role==='camera')send({id:p.id})},2000) })() }},[role])
 if(!role) return (<div style={{padding:20,background:'#000',color:'#fff',minHeight:'100vh'}}><h1>Cami</h1><button onClick={()=>{localStorage.setItem('cami-role','camera');location.reload()}}>Camera</button><button onClick={()=>{localStorage.setItem('cami-role','viewer');location.reload()}} style={{marginLeft:10}}>Viewer</button></div>)
 if(role==='camera') return (<div style={{background:'#000',color:'#555',minHeight:'100vh',display:'grid',placeItems:'center'}}><p>Camera active - LED ON</p><button onClick={()=>{localStorage.clear();location.reload()}}>Reset</button></div>)
 return (<div style={{padding:16}}><b>Viewer</b>{Object.values(cams).map(c=><div key={c.id}><span>{c.id}</span><button onClick={()=>{ const co=peerRef.current.connect(c.id); co.on('open',()=>co.send({type:'a'}))}}>Allumer</button></div>)}<video ref={vRef} autoPlay playsInline style={{width:'100%',background:'#111',aspectRatio:'16/9'}}/></div>)
}
