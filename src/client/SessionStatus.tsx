import {useEffect,useState} from 'react';
// Compact session indicators for the top bar and title row.
export function PlugIcon({off=false}:{off?:boolean}){
  return <svg className="plug-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v5M15 2v5M6 7h12v5a6 6 0 0 1-12 0V7ZM12 18v4"/>
    {off&&<path d="M3 3l18 18"/>}
  </svg>;
}

export function StepProgress({index,count}:{index:number;count:number}){
  if(index<0)return <p className="step-progress"><span>Lobby</span></p>;
  const step=Math.min(index+1,count);
  return <div className="step-progress">
    <span className="step-count">Step {step} of {count}</span>
    <div className="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuemin={1} aria-valuemax={count} aria-valuenow={step} aria-valuetext={`Step ${step} of ${count}`}>
      <span style={{width:`${step/count*100}%`}}/>
    </div>
  </div>;
}

const icon=(path:string)=><svg className="status-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
const clockPath='M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2';
const timerPath='M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z';
export const formatElapsed=(ms:number)=>{
  const total=Math.max(0,Math.floor(ms/1000)),h=Math.floor(total/3600),m=Math.floor(total/60)%60,s=total%60;
  const two=(n:number)=>String(n).padStart(2,'0');
  return h?`${h}:${two(m)}:${two(s)}`:`${m}:${two(s)}`;
};

// Current time and running session time. Elapsed time uses the server's clock (via the offset
// measured from serverNow), so every screen shows the same session time even if a device clock is off.
export function SessionClock({startedAt,endedAt,serverNow}:{startedAt?:number;endedAt?:number;serverNow:number}){
  const [offset,setOffset]=useState(0),[now,setNow]=useState(Date.now());
  useEffect(()=>setOffset(serverNow-Date.now()),[serverNow]);
  useEffect(()=>{
    // Tick on the second boundary so the clock and timer change together.
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{setNow(Date.now());timer=setTimeout(tick,1000-Date.now()%1000);};
    tick();return()=>clearTimeout(timer);
  },[]);
  const time=new Date(now).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const elapsed=startedAt?formatElapsed((endedAt??now+offset)-startedAt):undefined;
  return <>
    <span className="status-badge current-time" title="Current time">{icon(clockPath)}<span className="visually-hidden">Current time </span><time>{time}</time></span>
    <span className={`status-badge session-time${endedAt?' stopped':''}`} title={endedAt?'Session length':'Session time'}>{icon(timerPath)}<span className="visually-hidden">{endedAt?'Session length ':'Session time '}</span><span className="elapsed">{elapsed??'Not started'}</span></span>
  </>;
}

// Room code and QR code for latecomers, pinned to the lower right of the teacher's screen.
export function JoinCorner({qr,code,joinUrl}:{qr:string;code:string;joinUrl:string}){
  const url=new URL(joinUrl);
  return <aside className="join-corner" aria-label="Join this class">
    <img src={qr} alt={`QR code to join room ${code}`} width="104" height="104"/>
    <div><span className="join-label">Join at {url.host}/join</span><strong className="join-code">{code}</strong></div>
  </aside>;
}
