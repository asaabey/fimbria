import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {Server} from 'socket.io';
import {Store} from './store.js';
import {parseLesson} from './validation.js';
import {importGithubLesson} from './github-import.js';
import {checkPassword} from './auth.js';
import lessonSchema from '../../schemas/lesson.schema.json' with {type:'json'};
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
// Public, canonical lesson schema for authors and agents (see public/docs/lesson-format.md).
app.get('/lesson.schema.json',(_req,res)=>{res.set('Cache-Control','public, max-age=300');res.type('application/schema+json').json(lessonSchema);});
const attempts=new Map<string,{n:number;until:number}>(),loginLimit=Number(process.env.LOGIN_ATTEMPTS_PER_MINUTE)||10;
app.post('/api/login',(req,res)=>{
  const key=req.ip||'local',now=Date.now();
  let rate=attempts.get(key);if(!rate||rate.until<now){rate={n:0,until:now+60000};attempts.set(key,rate);}
  if(++rate.n>loginLimit)return void res.status(429).json({error:'Try again in one minute'});
  const teacher=store.db.prepare('SELECT hash FROM teacher WHERE id=1').get();
  if(!teacher||typeof req.body.password!=='string'||!checkPassword(req.body.password,teacher.hash as string))return void res.status(401).json({error:'Invalid password'});
  const credential=randomBytes(32).toString('hex');
  store.db.prepare('INSERT INTO auth VALUES(?,?)').run(credential,now+12*3600000);
  res.setHeader('Set-Cookie',`teacher=${credential}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
  res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{store.db.prepare('DELETE FROM auth WHERE token=?').run(token(req.headers.cookie));res.setHeader('Set-Cookie','teacher=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/teacher',(req,res)=>res.status(authorized(req.headers.cookie)?200:401).json({ok:authorized(req.headers.cookie)}));
// Printable handouts. A saved lesson or a running session for the teacher; an ended session for its students (X-Participant credential).
app.get('/api/handout',(req,res)=>{
  res.set('Cache-Control','no-store');
  const teacher=authorized(req.headers.cookie),{lesson,room}=req.query;
  try{
    if(typeof lesson==='string'){
      if(!teacher)return void res.status(401).json({error:'Teacher login required'});
      const row=store.db.prepare('SELECT body FROM lessons WHERE id=?').get(lesson);
      if(!row)return void res.status(404).json({error:'Lesson not found'});
      return void res.json({lesson:JSON.parse(row.body as string)});
    }
    if(typeof room!=='string')return void res.status(400).json({error:'Choose a lesson or session'});
    res.json(store.handout(room,teacher,req.get('x-participant')||undefined));
  }catch(e){res.status((e as Error).message==='Room not found'?404:(e as {status?:number}).status||400).json({error:(e as Error).message});}
});
app.use('/api', (req,res,next)=>{if(!authorized(req.headers.cookie))return void res.status(401).json({error:'Teacher login required'});next();});
app.get('/api/lessons',(_req,res)=>res.json(store.db.prepare('SELECT id,body FROM lessons ORDER BY rowid DESC').all().map(r=>({id:r.id,lesson:JSON.parse(r.body as string)}))));
app.get('/api/rooms',(_req,res)=>res.json(store.sessions()));
app.post('/api/lessons',(req,res)=>{try{const lesson=parseLesson(req.body);res.json({id:store.lesson(lesson),lesson});}catch(e){res.status(400).json({error:(e as Error).message});}});
app.post('/api/lessons/import',async(req,res)=>{
  try {
    const lesson=await importGithubLesson(req.body?.url);
    res.json({id:store.lesson(lesson),lesson});
  } catch(error) {
    res.status(400).json({error:(error as Error).message});
  }
});
app.delete('/api/lessons/:id',(req,res)=>{try{store.deleteLesson(req.params.id);res.json({ok:true});}catch(e){res.status(404).json({error:(e as Error).message});}});
app.post('/api/rooms',(req,res)=>{try{res.json({id:store.create(req.body.lessonId)});}catch(e){res.status(400).json({error:(e as Error).message});}});
// End a session from the teacher home page (same as End session in the controls); connected screens update.
app.post('/api/rooms/end-all',(_req,res)=>{const ids=store.endAll();ids.forEach(broadcast);res.json({ended:ids.length});});
app.post('/api/rooms/:id/end',(req,res)=>{
  try{const {id}=store.room(req.params.id);store.action(id,'END');broadcast(id);res.json({ok:true});}
  catch(e){const message=(e as Error).message;res.status(message==='Room not found'?404:409).json({error:message});}
});
// Every screen in a room is in the Socket.IO room of the same id. Views are built once per broadcast.
const screens=(id:string)=>[...(io.sockets.adapter.rooms.get(id)??[])].map(sid=>io.sockets.sockets.get(sid)).filter(s=>!!s);
const viewFor=(views:ReturnType<Store['views']>,socket:{data:any})=>socket.data.teacher?views.teacher:socket.data.credential?views.student(socket.data.credential):views.base;
// Host actions change what everyone sees.
function broadcast(id:string){const views=store.views(id);for(const socket of screens(id))socket.emit('room_state_update',viewFor(views,socket));}
// Joins and votes change only the teacher's counts (and the voter's own answer), so only those screens hear about them.
// Sending them to every screen made a question round cost N² updates and capped a room at about 200 students.
function notifyTeachers(id:string,also?:{data:any;emit:Function}){
  const views=store.views(id);
  for(const socket of screens(id))if(socket.data.teacher)socket.emit('room_state_update',views.teacher);
  if(also&&!also.data.teacher)also.emit('room_state_update',viewFor(views,also));
}
io.on('connection',socket=>{
  const handle=(event:string,fn:(data:any)=>unknown)=>socket.on(event,(data,ack)=>{if(typeof ack!=='function')return;try{ack({ok:true,data:fn(data||{})});}catch(e){ack({ok:false,error:(e as Error).message});}});
  handle('join_room',data=>{
    if(data.role==='teacher'){
      if(!authorized(socket.handshake.headers.cookie))throw new Error('Teacher login required');
      socket.data.teacher=true;socket.data.room=store.room(data.roomId).id;
    }else if(data.role==='display'){socket.data.room=store.room(data.roomId).id;socket.data.teacher=false;}
    else{const joined=store.join(data.roomId,data.credential);socket.data.room=joined.id;socket.data.credential=joined.credential;socket.data.teacher=false;}
    for(const joined of socket.rooms)if(joined!==socket.id&&joined!==socket.data.room)socket.leave(joined);
    socket.join(socket.data.room);
    if(data.role!=='teacher'&&data.role!=='display')notifyTeachers(socket.data.room);
    return {credential:socket.data.credential,state:store.snapshot(socket.data.room,socket.data.teacher,socket.data.credential)};
  });
  handle('host_action',data=>{
    if(!socket.data.teacher||!authorized(socket.handshake.headers.cookie))throw new Error('Teacher login required');
    store.action(socket.data.room,data.action);broadcast(socket.data.room);return store.snapshot(socket.data.room,true);
  });
  handle('submit_vote',data=>{
    if(!socket.data.credential)throw new Error('Join first');
    const answer=store.vote(socket.data.room,socket.data.credential,data.questionId,data.optionId,data.revision);
    notifyTeachers(socket.data.room,socket);return {answer};
  });
});
setInterval(()=>{store.expire(Number(process.env.SESSION_TTL_HOURS||24)*3600000);for(const id of new Set([...io.sockets.sockets.values()].map(s=>s.data.room).filter(Boolean)))broadcast(id);},60000).unref();
if(process.env.NODE_ENV!=='production'){
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}else{app.use(express.static('dist/client'));app.get('/{*path}',(_req,res)=>res.sendFile('index.html',{root:'dist/client'}));}
app.use((err:any,_req:any,res:any,_next:any)=>res.status(400).json({error:err.message||'Invalid request'}));
http.listen(port,'0.0.0.0',()=>console.log(`Live Lesson listening on ${port}`));
