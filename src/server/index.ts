import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {Server} from 'socket.io';
import {Store} from './store.js';
import {parseLesson} from './validation.js';
import {importGithubLesson} from './github-import.js';
import {checkPassword} from './auth.js';
const port=Number(process.env.PORT||3000);
const publicOrigin=new URL(process.env.PUBLIC_BASE_URL||`http://localhost:${port}`).origin;
const store=new Store(process.env.DB_PATH||'data/app.sqlite',process.env.PUBLIC_BASE_URL||`http://localhost:${port}`);
const app=express(),http=createServer(app),io=new Server(http,{maxHttpBufferSize:65536,allowRequest:(req,callback)=>callback(null,!req.headers.origin||req.headers.origin===publicOrigin)});
app.disable('x-powered-by');
app.use(express.json({limit:'256kb'}));
const token=(cookie='')=>cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('teacher='))?.slice(8)||'';
const authorized=(cookie?:string)=>!!store.db.prepare('SELECT token FROM auth WHERE token=? AND expires>?').get(token(cookie),Date.now());
app.use((req,res,next)=>{
  if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==(process.env.PUBLIC_BASE_URL||`http://localhost:${port}`))return void res.status(403).json({error:'Origin rejected'});
  next();
});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
const attempts=new Map<string,{n:number;until:number}>();
app.post('/api/login',(req,res)=>{
  const key=req.ip||'local',now=Date.now();
  let rate=attempts.get(key);if(!rate||rate.until<now){rate={n:0,until:now+60000};attempts.set(key,rate);}
  if(++rate.n>10)return void res.status(429).json({error:'Try again in one minute'});
  const teacher=store.db.prepare('SELECT hash FROM teacher WHERE id=1').get();
  if(!teacher||typeof req.body.password!=='string'||!checkPassword(req.body.password,teacher.hash as string))return void res.status(401).json({error:'Invalid password'});
  const credential=randomBytes(32).toString('hex');
  store.db.prepare('INSERT INTO auth VALUES(?,?)').run(credential,now+12*3600000);
  res.setHeader('Set-Cookie',`teacher=${credential}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
  res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{store.db.prepare('DELETE FROM auth WHERE token=?').run(token(req.headers.cookie));res.setHeader('Set-Cookie','teacher=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/teacher',(req,res)=>res.status(authorized(req.headers.cookie)?200:401).json({ok:authorized(req.headers.cookie)}));
app.use('/api', (req,res,next)=>{if(!authorized(req.headers.cookie))return void res.status(401).json({error:'Teacher login required'});next();});
app.get('/api/lessons',(_req,res)=>res.json(store.db.prepare('SELECT id,body FROM lessons ORDER BY rowid DESC').all().map(r=>({id:r.id,lesson:JSON.parse(r.body as string)}))));
app.get('/api/rooms',(_req,res)=>res.json(store.db.prepare("SELECT id,code,phase FROM rooms WHERE phase!='ENDED' ORDER BY updated DESC").all()));
app.post('/api/lessons',(req,res)=>{try{const lesson=parseLesson(req.body);res.json({id:store.lesson(lesson),lesson});}catch(e){res.status(400).json({error:(e as Error).message});}});
app.post('/api/lessons/import',async(req,res)=>{
  try {
    const lesson=await importGithubLesson(req.body?.url);
    res.json({id:store.lesson(lesson),lesson});
  } catch(error) {
    res.status(400).json({error:(error as Error).message});
  }
});
app.post('/api/rooms',(req,res)=>{try{res.json({id:store.create(req.body.lessonId)});}catch(e){res.status(400).json({error:(e as Error).message});}});
function broadcast(id:string){for(const socket of io.sockets.sockets.values())if(socket.data.room===id)socket.emit('room_state_update',store.snapshot(id,socket.data.teacher,socket.data.credential));}
io.on('connection',socket=>{
  const handle=(event:string,fn:(data:any)=>unknown)=>socket.on(event,(data,ack)=>{if(typeof ack!=='function')return;try{ack({ok:true,data:fn(data||{})});}catch(e){ack({ok:false,error:(e as Error).message});}});
  handle('join_room',data=>{
    if(data.role==='teacher'){
      if(!authorized(socket.handshake.headers.cookie))throw new Error('Teacher login required');
      socket.data.teacher=true;socket.data.room=store.room(data.roomId).id;
    }else if(data.role==='display'){socket.data.room=store.room(data.roomId).id;socket.data.teacher=false;}
    else{const joined=store.join(data.roomId,data.credential);socket.data.room=joined.id;socket.data.credential=joined.credential;socket.data.teacher=false;}
    broadcast(socket.data.room);
    return {credential:socket.data.credential,state:store.snapshot(socket.data.room,socket.data.teacher,socket.data.credential)};
  });
  handle('host_action',data=>{
    if(!socket.data.teacher||!authorized(socket.handshake.headers.cookie))throw new Error('Teacher login required');
    store.action(socket.data.room,data.action);broadcast(socket.data.room);return store.snapshot(socket.data.room,true);
  });
  handle('submit_vote',data=>{
    if(!socket.data.credential)throw new Error('Join first');
    const answer=store.vote(socket.data.room,socket.data.credential,data.questionId,data.optionId,data.revision);
    broadcast(socket.data.room);return {answer};
  });
});
setInterval(()=>{store.expire(Number(process.env.SESSION_TTL_HOURS||24)*3600000);for(const id of new Set([...io.sockets.sockets.values()].map(s=>s.data.room).filter(Boolean)))broadcast(id);},60000).unref();
if(process.env.NODE_ENV!=='production'){
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}else{app.use(express.static('dist/client'));app.get('/{*path}',(_req,res)=>res.sendFile('index.html',{root:'dist/client'}));}
app.use((err:any,_req:any,res:any,_next:any)=>res.status(400).json({error:err.message||'Invalid request'}));
http.listen(port,'0.0.0.0',()=>console.log(`Live Lesson listening on ${port}`));
