import {io, type Socket} from 'socket.io-client';
import {readFileSync} from 'node:fs';
const args=process.argv.slice(2);
const arg=(key:string,fallback:string)=>args[args.indexOf(key)+1]||fallback;
const count=Number(args.includes('--students')?arg('--students','40'):'40');
const durationText=args.includes('--duration')?arg('--duration','30m'):'10s';
const duration=Number.parseFloat(durationText)*(durationText.endsWith('m')?60000:durationText.endsWith('h')?3600000:1000);
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
if(!process.env.TEACHER_PASSWORD)throw new Error('Set TEACHER_PASSWORD');
let cookie='';
async function post(path:string,data:unknown){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];const body=await r.json();if(!r.ok)throw new Error(JSON.stringify(body));return body;}
await post('login',{password:process.env.TEACHER_PASSWORD});
const lesson=await post('lessons',JSON.parse(readFileSync('examples/intro.json','utf8')));
const room=await post('rooms',{lessonId:lesson.id});
const sockets:Socket[]=[];
const latencies:number[]=[],updates:number[]=[];
let errors=0,unexpectedDisconnects=0,deliberate=false,commandAt=0;
function connect(teacher=false){const s=io(base,{autoConnect:false,extraHeaders:teacher?{cookie}:{},reconnection:true});sockets.push(s);s.on('disconnect',()=>{if(!deliberate)unexpectedDisconnects++;});s.on('room_state_update',()=>{if(commandAt)updates.push(performance.now()-commandAt);});return new Promise<Socket>((resolve,reject)=>{s.once('connect',()=>resolve(s));s.once('connect_error',reject);s.connect();});}
function emit(s:Socket,event:string,data:unknown):Promise<any>{return new Promise((resolve,reject)=>s.timeout(5000).emit(event,data,(err:any,r:any)=>{if(err||!r?.ok){errors++;reject(err||new Error(r.error));}else resolve(r.data);}));}
const teacher=await connect(true);await emit(teacher,'join_room',{role:'teacher',roomId:room.id});
const students:{s:Socket;credential:string}[]=[];
for(let i=0;i<count;i++){const s=await connect();const joined=await emit(s,'join_room',{roomId:room.id});students.push({s,credential:joined.credential});await new Promise(r=>setTimeout(r,5));}
const display=await connect();await emit(display,'join_room',{roomId:room.id,role:'display'});
async function action(action:string){commandAt=performance.now();const state=await emit(teacher,'host_action',{action});await new Promise(r=>setTimeout(r,20));commandAt=0;return state;}
await action('START');await action('NEXT');
for(let q=1;q<=3;q++){
  const state=await action('NEXT');
  await Promise.all(students.map(async({s},i)=>{await new Promise(r=>setTimeout(r,(i%7)*10));const start=performance.now();await emit(s,'submit_vote',{questionId:'q'+q,optionId:i%2?'a':'b',revision:state.revision});latencies.push(performance.now()-start);}));
  const revealed=await action('REVEAL');
  if(Object.values(revealed.totals as Record<string,number>).reduce((a,b)=>a+b,0)!==count)throw new Error('Total mismatch');
}
deliberate=true;
for(const {s} of students.slice(0,5))s.disconnect();
for(const {s,credential} of students.slice(0,5)){await new Promise<void>(r=>{s.once('connect',()=>r());s.connect();});const joined=await emit(s,'join_room',{roomId:room.id,credential});if(!joined.state.answer)throw new Error('Lost answer');}
deliberate=false;
const until=Date.now()+duration;
while(Date.now()<until){await new Promise(r=>setTimeout(r,Math.min(1000,until-Date.now())));await emit(teacher,'join_room',{roomId:room.id,role:'teacher'});}
await action('END');
const p95=(n:number[])=>n.sort((a,b)=>a-b)[Math.floor(n.length*.95)];
console.log(JSON.stringify({students:count,duration:durationText,errors,unexpectedDisconnects,voteP95Ms:p95(latencies),updateP95Ms:p95(updates),simulatorMemory:process.memoryUsage(),simulatorCpu:process.cpuUsage()},null,2));
deliberate=true;sockets.forEach(s=>s.disconnect());
if(errors||unexpectedDisconnects||p95(latencies)>500||p95(updates)>500)process.exitCode=1;
