import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import QRCode from 'qrcode';
import type {Lesson,Snapshot,Reply,Action} from '../shared/contracts.js';
import './style.css';
import {ThemeSelector} from './ThemeSelector.js';
const socket=io({autoConnect:false});
async function api(path:string,body?:unknown){const res=await fetch('/api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await res.json();if(!res.ok)throw new Error(value.error||'Login required');return value;}
function App(){
  const path=location.pathname.split('/'),role=path[1]==='host'?'teacher':path[1]==='display'?'display':'student';
  const [room,setRoom]=useState(path[2]||''),[code,setCode]=useState(new URLSearchParams(location.search).get('code')||''),[state,setState]=useState<Snapshot>(),[error,setError]=useState(''),[connected,setConnected]=useState(false),[pending,setPending]=useState(false),[logged,setLogged]=useState(false),[password,setPassword]=useState(''),[lessons,setLessons]=useState<{id:string;lesson:Lesson}[]>([]),[selected,setSelected]=useState(''),[rooms,setRooms]=useState<{id:string;code:string;phase:string}[]>([]),[qr,setQr]=useState('');
  const [githubUrl,setGithubUrl]=useState(''),[importing,setImporting]=useState(false);
  const teacherHome=location.pathname==='/'||location.pathname==='/teacher';
  async function load(){setLessons(await api('lessons'));setRooms(await api('rooms'));}
  useEffect(()=>{if(teacherHome)api('teacher').then(()=>{setLogged(true);void load();}).catch(()=>{});},[]);
  useEffect(()=>{
    if(!room)return;
    const join=()=>{setConnected(true);socket.emit('join_room',{roomId:room,role,credential:localStorage.getItem('participant:'+room)},(reply:Reply<{credential?:string;state:Snapshot}>)=>{
      if(!reply.ok){setError(reply.error);return;}setState(reply.data.state);
      if(reply.data.credential)localStorage.setItem('participant:'+room,reply.data.credential);
    });};
    const disconnect=()=>{setConnected(false);setPending(false);};
    const update=(value:Snapshot)=>{setState(value);if(value.answer)setPending(false);};
    socket.on('connect',join);socket.on('disconnect',disconnect);socket.on('room_state_update',update);socket.connect();
    return()=>{socket.off('connect',join);socket.off('disconnect',disconnect);socket.off('room_state_update',update);socket.disconnect();};
  },[room]);
  useEffect(()=>{if(state)QRCode.toDataURL(state.joinUrl).then(setQr).catch(()=>{});},[state?.joinUrl]);
  function command(action:Action){setError('');socket.emit('host_action',{action},(reply:Reply)=>{if(!reply.ok)setError(reply.error);});}
  async function run(fn:()=>Promise<void>){setError('');try{await fn();}catch(e){setError((e as Error).message);}}
  const preview=lessons.find(l=>l.id===selected);
  return <main><header><a className="wordmark" href="/" aria-label="Fimbria home">Fimbria<span>Live lessons, shared understanding.</span></a><div className="header-tools"><a href="/join">Join a class</a><ThemeSelector/></div></header>
    {error&&<p role="alert" className="error">{error}</p>}
    {teacherHome?<><h1>Teach one step at a time.</h1><p className="muted">Present a lesson. Give everyone a voice.</p>
      {!logged?<form onSubmit={e=>{e.preventDefault();void run(async()=>{await api('login',{password});setPassword('');setLogged(true);await load();});}}><h2>Teacher login</h2><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button>Sign in</button></form>:
      <><button className="secondary" onClick={()=>void run(async()=>{await api('logout',{});setLogged(false);})}>Sign out</button><section><h2>Prepare your lesson</h2><label>Upload lesson JSON<input type="file" accept=".json,application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{if(file.size>256*1024)throw new Error('Lesson must be smaller than 256 KB');const result=await api('lessons',JSON.parse(await file.text()));await load();setSelected(result.id);});}}/></label><div className="github-import"><h3>Import from GitHub</h3><p className="muted" id="github-help">Paste a public GitHub JSON file link or raw file URL. Use a commit link to select an exact version. A copy is saved for your class.</p><label>GitHub lesson URL<input type="url" placeholder="https://github.com/owner/repo/blob/main/lesson.json" aria-describedby="github-help" value={githubUrl} disabled={importing} onChange={e=>setGithubUrl(e.target.value)}/></label><button disabled={importing||!githubUrl.trim()} onClick={()=>void run(async()=>{
        setImporting(true);
        try {
          const result=await api('lessons/import',{url:githubUrl});
          await load();setSelected(result.id);setGithubUrl('');
        } finally {setImporting(false);}
      })}>{importing?'Importing…':'Import lesson'}</button>{importing&&<p role="status">Fetching and validating your lesson…</p>}</div><label>Saved lessons<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a lesson</option>{lessons.map(l=><option key={l.id} value={l.id}>{l.lesson.title}</option>)}</select></label>
      {preview&&<><h3>{preview.lesson.title}</h3><ol>{preview.lesson.steps.map(s=><li key={s.id}><strong>{s.type==='slide'?s.title:s.prompt}</strong><p>{s.type==='slide'?s.body:s.options.map(o=>o.text).join(' · ')}</p>{s.type==='question'&&<p>Correct: {s.options.find(o=>o.id===s.correctOptionId)?.text}. {s.explanation}</p>}</li>)}</ol><button onClick={()=>void run(async()=>{const r=await api('rooms',{lessonId:selected});location.href='/host/'+r.id;})}>Start session</button></>}</section>
      {rooms.length>0&&<section><h2>Resume a session</h2>{rooms.map(r=><p key={r.id}><a href={'/host/'+r.id}>{r.code} — {r.phase}</a></p>)}</section>}</>}
    </>:!room?<><h1>Join your class</h1><p>Enter the six-digit code on the presentation.</p><form onSubmit={e=>{e.preventDefault();setRoom(code);history.replaceState(null,'','/play/'+code);}}><label>Room code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button>Join</button></form></>:
    <><p role="status" className="muted">{connected?'Connected':'Reconnecting… Your recorded answer is saved.'}</p>{state?<><div className="meta"><span>Room {state.code}</span><span>{state.index<0?'Lobby':`Step ${state.index+1} of ${state.stepCount}`}</span></div><h1>{state.title}</h1>
      {state.phase==='ENDED'?<section><h2>Session complete</h2><p>Thank you for taking part.</p></section>:state.phase==='WAITING'?<section><h2>{role==='student'?'Waiting for your teacher…':'Ready when you are.'}</h2><p>Join at <a href={state.joinUrl}>{state.joinUrl}</a></p><p className="roomCode">{state.code}</p>{role!=='student'&&<img width="180" height="180" src={qr} alt="QR code to join this class"/>}</section>:<section>{state.step?.type==='slide'?<><h2>{state.step.title}</h2><p className="body">{state.step.body}</p></>:state.step&&<><h2>{state.step.prompt}</h2><div className="options">{state.step.options.map((o,i)=><div key={o.id}>{role==='student'?<button className="answer" disabled={!connected||pending||!!state.answer||state.closed} onClick={()=>{setPending(true);setError('');socket.emit('submit_vote',{questionId:state.step!.id,optionId:o.id,revision:state.revision},(reply:Reply)=>{setPending(false);if(!reply.ok)setError(reply.error);});}}>{String.fromCharCode(65+i)}. {o.text}{state.answer===o.id?' — Your answer':''}</button>:<p>{String.fromCharCode(65+i)}. {o.text}</p>}{state.totals&&<><progress max={Math.max(1,Object.values(state.totals).reduce((a,b)=>a+b,0))} value={state.totals[o.id]||0}/><span> {state.totals[o.id]||0} responses {state.step?.type==='question'&&state.step.correctOptionId===o.id?' · Correct answer':''}</span></>}</div>)}</div>{role==='student'&&<p role="status">{state.answer?'Answer submitted and saved.':pending?'Submitting…':state.closed?'Voting closed.':'Choose one answer.'}</p>}{state.step.explanation&&<p className="body">{state.step.explanation}</p>}</>}</section>}
      {role==='teacher'&&<section><p>{state.participants} participants · {state.responses||0} responses</p><a target="_blank" rel="noreferrer" href={'/display/'+state.id}>Open presentation display ↗</a><nav>{state.phase==='WAITING'?<button disabled={!connected} onClick={()=>command('START')}>Begin lesson</button>:state.phase!=='ENDED'&&<><button disabled={!connected||state.index===0} onClick={()=>command('PREVIOUS')}>Previous</button><button disabled={!connected||state.index>=state.stepCount-1} onClick={()=>command('NEXT')}>Next</button>{state.step?.type==='question'&&<button disabled={!connected||state.phase==='REVEALED'} onClick={()=>command('REVEAL')}>Reveal results</button>}</>}{state.phase!=='ENDED'&&<button className="secondary" disabled={!connected} onClick={()=>command('END')}>End session</button>}</nav></section>}</>:<p>Joining room…</p>}</>}
    <footer>Fimbria · Live lessons, shared understanding.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
