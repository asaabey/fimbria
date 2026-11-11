import {useEffect,useRef,useState} from 'react';
import type {Handout as Data} from '../shared/contracts.js';
import {LessonImage} from './LessonImage.js';
import {LessonTable} from './LessonTable.js';
import {BodyText} from './BodyText.js';

// Printable lesson handout. The browser's print dialog saves it as a PDF, which handles
// every image type (SVG, remote images), tables and symbols without a server-side PDF engine.
//   /handout?lesson=<id>  teacher, saved lesson
//   /handout?room=<id>    teacher, session with vote totals
//   /handout?room=<code>  student, after the session ends, with their answers
const credentialFor=(room:string)=>{try{return localStorage.getItem('participant:'+room);}catch{return null;}};
const videoLink=(src:string)=>new URL(src,location.origin).href;

export function Handout(){
  const params=new URLSearchParams(location.search),lessonId=params.get('lesson'),room=params.get('room');
  const [data,setData]=useState<Data>(),[error,setError]=useState(''),[ready,setReady]=useState(false),printed=useRef(false);
  useEffect(()=>{
    const credential=room&&credentialFor(room);
    const query=lessonId?'lesson='+encodeURIComponent(lessonId):room?'room='+encodeURIComponent(room):'';
    if(!query){setError('Choose a lesson or session to print.');return;}
    fetch('/api/handout?'+query,{headers:credential?{'X-Participant':credential}:{}})
      .then(async res=>{const value=await res.json();if(!res.ok)throw new Error(value.error||'Handout unavailable');return value as Data;})
      .then(value=>{setData(value);document.title=`${value.lesson.title} — Fimbria handout`;})
      .catch(e=>setError((e as Error).message));
  },[]);
  // Open the Save-as-PDF dialog once, after every image has loaded or failed.
  useEffect(()=>{
    if(!data)return;
    const pending=Array.from(document.images).filter(img=>!img.complete).map(img=>new Promise(done=>{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});}));
    void Promise.all(pending).then(()=>{setReady(true);if(!printed.current){printed.current=true;window.print();}});
  },[data]);
  const student=!!data?.answers;
  return <main className="handout">
    <div className="handout-toolbar" role="group" aria-label="Handout actions">
      <a className="wordmark" href="/">Fimbria</a>
      {data&&<><button disabled={!ready} onClick={()=>window.print()}>Save as PDF</button><p className="muted">In the print window, choose <strong>Save as PDF</strong> as the printer.</p></>}
    </div>
    {error?<section><h1>Handout unavailable</h1><p role="alert" className="error">{error}</p></section>:!data?<p role="status">Preparing your handout…</p>:<>
      <header className="handout-header">
        <h1>{data.lesson.title}</h1>
        <p className="muted">{[data.code&&`Session ${data.code}`,new Date().toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}),`${data.lesson.steps.length} steps`,student?'Includes your answers':data.totals?'Includes class responses':'Teacher copy with answers'].filter(Boolean).join(' · ')}</p>
      </header>
      <ol className="handout-steps">{data.lesson.steps.map((step,n)=>{
        const label=`Step ${n+1} · ${step.type==='slide'?'Slide':step.type==='video'?'Video':'Question'}`;
        if(step.type==='video')return <li key={step.id} className="handout-step"><p className="step-label">{label}</p><h2>{step.title}</h2><p>Watch: <a href={videoLink(step.src)}>{videoLink(step.src)}</a></p></li>;
        const visual=<>{step.image&&<LessonImage image={step.image} eager/>}</>;
        if(step.type==='slide')return <li key={step.id} className="handout-step"><p className="step-label">{label}</p><h2>{step.title}</h2>{visual}{step.body&&<BodyText text={step.body}/>}{step.table&&<LessonTable table={step.table}/>}</li>;
        const votes=data.totals?.[step.id],total=votes?Object.values(votes).reduce((a,b)=>a+b,0):0,mine=data.answers?.[step.id];
        return <li key={step.id} className="handout-step"><p className="step-label">{label}</p><h2>{step.prompt}</h2>{visual}{step.table&&<LessonTable table={step.table}/>}
          <ol className="handout-options">{step.options.map((o,i)=>{
            const notes=[o.id===step.correctOptionId&&'✓ Correct answer',mine===o.id&&'Your answer',votes&&`${votes[o.id]||0} of ${total} responses`].filter(Boolean);
            return <li key={o.id} className={o.id===step.correctOptionId?'correct':undefined}><span className="letter">{String.fromCharCode(65+i)}.</span> {o.text}{notes.length>0&&<span className="option-notes"> — {notes.join(' · ')}</span>}</li>;
          })}</ol>
          {student&&!mine&&<p className="muted">You did not answer this question.</p>}
          {step.explanation&&<div className="handout-explanation"><h3>Explanation</h3><BodyText text={step.explanation}/></div>}
        </li>;
      })}</ol>
      <footer>Made with Fimbria · {location.host}</footer>
    </>}
  </main>;
}
