// Ramp load test: finds how many students one Fimbria room handles before it slows down.
// Plain JavaScript so it runs anywhere with `npm ci` (no tsx). Students are spread across worker processes.
//
//   TEACHER_PASSWORD=... node scripts/load-test.mjs --base http://host:port --stages 40,80,160,320 \
//     [--workers 4] [--join-window 30] [--vote-window 10] [--max-p95 2000]
//
// Per stage it creates a fresh room, joins N students over --join-window seconds, moves to a question,
// has every student vote at a random moment within --vote-window seconds, reveals, and ends the room.
// It measures how long the class takes to see the teacher's Next/Reveal (fan-out), how long votes take
// to be accepted, failures, disconnects and data received. It stops after the first stage whose fan-out
// or vote p95 exceeds --max-p95 ms or whose failures exceed 1%.
import {io} from 'socket.io-client';
import {fork} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const now=()=>performance.timeOrigin+performance.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const args=process.argv.slice(2);
const opt=(key,fallback)=>{const i=args.indexOf('--'+key);return i>=0?args[i+1]:fallback;};

if(args.includes('--worker'))worker();else await main();

// ---------- worker: owns a slice of the students ----------
function worker(){
  const base=opt('base');
  let students=[];
  const send=msg=>process.send(msg);
  const emit=(s,event,data,timeout=15000)=>new Promise(resolve=>{
    s.timeout(timeout).emit(event,data,(err,reply)=>resolve(err?{ok:false,error:'timeout'}:reply));
  });
  process.on('message',async msg=>{
    if(msg.type==='join'){
      const {roomId,count,windowMs}=msg;
      students=[];
      const results=await Promise.all(Array.from({length:count},async()=>{
        await sleep(Math.random()*windowMs);
        const st={s:io(base,{transports:['websocket'],reconnection:false,forceNew:true}),revision:-1,arrivals:new Map(),bytes:0,messages:0,disconnected:false};
        st.s.on('room_state_update',state=>{st.messages++;if(st.messages%20===1)st.bytes+=JSON.stringify(state).length*20;if(state.revision>st.revision){st.revision=state.revision;st.arrivals.set(state.revision,now());}});
        st.s.on('disconnect',reason=>{if(reason!=='io client disconnect')st.disconnected=true;});
        const start=now();
        const connected=await new Promise(r=>{st.s.once('connect',()=>r(true));st.s.once('connect_error',()=>r(false));setTimeout(()=>r(false),20000);});
        if(!connected)return {ok:false,ms:now()-start,error:'connect'};
        const reply=await emit(st.s,'join_room',{roomId});
        if(!reply?.ok)return {ok:false,ms:now()-start,error:reply?.error||'join'};
        st.revision=Math.max(st.revision,reply.data.state.revision);
        students.push(st);
        return {ok:true,ms:now()-start};
      }));
      send({type:'joined',results});
    }
    if(msg.type==='await'){
      // Arrival time of the first update at or after this revision, per student.
      const deadline=now()+msg.timeoutMs;
      while(now()<deadline&&students.some(st=>!firstAt(st,msg.revision)))await sleep(10);
      send({type:'arrived',times:students.map(st=>firstAt(st,msg.revision)??null)});
    }
    if(msg.type==='vote'){
      const {questionId,options,revision,windowMs}=msg;
      const results=await Promise.all(students.map(async(st,i)=>{
        await sleep(Math.random()*windowMs);
        const start=now();
        const reply=await emit(st.s,'submit_vote',{questionId,optionId:options[i%options.length],revision});
        return {ok:!!reply?.ok,ms:now()-start,error:reply?.ok?undefined:reply?.error};
      }));
      send({type:'voted',results});
    }
    if(msg.type==='stats'){
      send({type:'stats',bytes:students.reduce((a,st)=>a+st.bytes,0),messages:students.reduce((a,st)=>a+st.messages,0),disconnected:students.filter(st=>st.disconnected).length,cpu:process.cpuUsage()});
    }
    if(msg.type==='close'){for(const st of students)st.s.disconnect();students=[];send({type:'closed'});}
    if(msg.type==='exit')process.exit(0);
  });
  const firstAt=(st,revision)=>{let best;for(const [rev,t] of st.arrivals)if(rev>=revision&&(best===undefined||t<best))best=t;return best;};
}

// ---------- main: teacher, coordination and report ----------
async function main(){
  const base=opt('base',process.env.TEST_BASE_URL||'http://localhost:3000');
  const stages=opt('stages','40,80,160').split(',').map(Number);
  const workerCount=Number(opt('workers','4'));
  const joinWindow=Number(opt('join-window','30'))*1000,voteWindow=Number(opt('vote-window','10'))*1000,maxP95=Number(opt('max-p95','2000'));
  if(!process.env.TEACHER_PASSWORD)throw new Error('Set TEACHER_PASSWORD');
  let cookie='';
  const http=async(path,data)=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];const body=await r.json();if(!r.ok)throw new Error(path+': '+JSON.stringify(body));return body;};
  await http('login',{password:process.env.TEACHER_PASSWORD});
  const lessonJson=JSON.parse(readFileSync(new URL('../examples/intro.json',import.meta.url),'utf8'));
  const lesson=await http('lessons',lessonJson);
  const firstQuestion=lessonJson.steps.findIndex(s=>s.type==='question'),question=lessonJson.steps[firstQuestion];

  const workers=Array.from({length:workerCount},()=>fork(fileURLToPath(import.meta.url),['--worker','--base',base]));
  const ask=(w,msg,reply)=>new Promise(resolve=>{const on=m=>{if(m.type===reply){w.off('message',on);resolve(m);}};w.on('message',on);w.send(msg);});
  const all=(msgFor,reply)=>Promise.all(workers.map((w,i)=>ask(w,msgFor(i),reply)));
  const pct=(xs,p)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.floor(s.length*p))]);};
  const report=[];

  for(const n of stages){
    const startedAt=new Date().toISOString();
    try{
    console.error(`\n[${startedAt}] stage ${n} students: joining over ${joinWindow/1000}s`);
    const room=await http('rooms',{lessonId:lesson.id});
    const teacher=io(base,{transports:['websocket'],extraHeaders:{cookie},reconnection:false,forceNew:true});
    await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);});
    teacher.on('disconnect',reason=>console.error(`  teacher socket disconnected: ${reason}`));
    const temit=(event,data)=>new Promise(resolve=>teacher.timeout(30000).emit(event,data,(err,reply)=>resolve(err?{ok:false,error:'timeout'}:reply)));
    await temit('join_room',{role:'teacher',roomId:room.id});
    const cpuBefore=await all(()=>({type:'stats'}),'stats');

    const per=i=>Math.floor(n/workerCount)+(i<n%workerCount?1:0);
    const joins=(await all(i=>({type:'join',roomId:room.id,count:per(i),windowMs:joinWindow}),'joined')).flatMap(m=>m.results);
    const joined=joins.filter(r=>r.ok).length;

    // Teacher steps to the first question; measure how long until every student sees it.
    let state;
    const fanout=async action=>{
      const t0=now();const reply=await temit('host_action',{action});const ack=now()-t0;
      if(!reply?.ok)throw new Error(action+': '+reply?.error);
      const arrived=(await all(()=>({type:'await',revision:reply.data.revision,timeoutMs:30000}),'arrived')).flatMap(m=>m.times);
      const times=arrived.filter(t=>t!==null).map(t=>t-t0);
      return {state:reply.data,ack:Math.round(ack),p50:pct(times,.5),p95:pct(times,.95),max:pct(times,1),missing:arrived.length-times.length};
    };
    await fanout('START');
    for(let i=1;i<firstQuestion;i++)await fanout('NEXT');
    const next=await fanout('NEXT');state=next.state;
    console.error(`  NEXT reached ${n-next.missing} students: p95 ${next.p95} ms, slowest ${next.max} ms; voting over ${voteWindow/1000}s`);

    const voteStart=now();
    const votes=(await all(()=>({type:'vote',questionId:question.id,options:question.options.map(o=>o.id),revision:state.revision,windowMs:voteWindow}),'voted')).flatMap(m=>m.results);
    const voteSpan=now()-voteStart;
    const okVotes=votes.filter(v=>v.ok);
    const reveal=await fanout('REVEAL');
    const total=Object.values(reveal.state.totals||{}).reduce((a,b)=>a+b,0);
    const stats=await all(()=>({type:'stats'}),'stats');
    await temit('host_action',{action:'END'});
    teacher.disconnect();
    await all(()=>({type:'close'}),'closed');

    const errors=[...new Set([...joins,...votes].filter(r=>!r.ok).map(r=>r.error))];
    const genCpuMs=stats.reduce((a,s,i)=>a+(s.cpu.user+s.cpu.system-cpuBefore[i].cpu.user-cpuBefore[i].cpu.system)/1000,0);
    const row={
      students:n,joined,joinFail:n-joined,joinP95:pct(joins.filter(r=>r.ok).map(r=>r.ms),.95),
      nextP50:next.p50,nextP95:next.p95,nextMax:next.max,nextMissing:next.missing,
      votes:okVotes.length,voteFail:votes.length-okVotes.length,voteP50:pct(okVotes.map(v=>v.ms),.5),voteP95:pct(okVotes.map(v=>v.ms),.95),voteP99:pct(okVotes.map(v=>v.ms),.99),voteSpanS:+(voteSpan/1000).toFixed(1),
      revealP95:reveal.p95,revealMax:reveal.max,totalsMatch:total===okVotes.length,
      disconnects:stats.reduce((a,s)=>a+s.disconnected,0),messages:stats.reduce((a,s)=>a+s.messages,0),receivedMB:+(stats.reduce((a,s)=>a+s.bytes,0)/1e6).toFixed(1),
      generatorCpuS:+(genCpuMs/1000).toFixed(1),errors,startedAt,endedAt:new Date().toISOString(),
    };
    report.push(row);
    console.error('  '+JSON.stringify(row));
    const failRate=(row.joinFail+row.voteFail+row.nextMissing)/Math.max(1,n);
    if(Math.max(row.nextP95??Infinity,row.voteP95??Infinity,row.revealP95??Infinity)>maxP95||failRate>.01||!row.totalsMatch){
      console.error(`  stopping: past the limit (p95 > ${maxP95} ms, failures > 1% or totals mismatch)`);break;
    }
    }catch(error){
      // The server stopped answering within 30 s: record the stage as overloaded and stop.
      report.push({students:n,overloaded:true,error:error.message,startedAt,endedAt:new Date().toISOString()});
      console.error(`  overloaded at ${n} students: ${error.message}`);
      await Promise.race([all(()=>({type:'close'}),'closed'),sleep(10000)]);
      break;
    }
    await sleep(5000);
  }
  for(const w of workers)w.send({type:'exit'});
  console.log(JSON.stringify(report,null,2));
}
