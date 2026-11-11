import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import type {Action,Handout,Lesson,SessionSummary,Snapshot} from '../shared/contracts.js';
export class Store {
  db:DatabaseSync;
  constructor(path:string, public baseUrl='http://localhost:3000'){
    mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS teacher(id INTEGER PRIMARY KEY CHECK(id=1), hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, code TEXT UNIQUE, lesson TEXT NOT NULL, idx INTEGER DEFAULT -1, phase TEXT DEFAULT 'WAITING', revision INTEGER DEFAULT 0, visited TEXT DEFAULT '[]', revealed TEXT DEFAULT '[]', closed TEXT DEFAULT '[]', updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS participants(token TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id));
      CREATE TABLE IF NOT EXISTS answers(room TEXT NOT NULL, participant TEXT NOT NULL, question TEXT NOT NULL, option TEXT NOT NULL, PRIMARY KEY(room,participant,question));`);
    // Session clock: when the teacher began the lesson and when the session ended (added after launch).
    const columns=new Set(this.db.prepare('PRAGMA table_info(rooms)').all().map(c=>c.name as string));
    if(!columns.has('started'))this.db.exec('ALTER TABLE rooms ADD COLUMN started INTEGER');
    if(!columns.has('ended'))this.db.exec('ALTER TABLE rooms ADD COLUMN ended INTEGER');
  }
  lesson(input:Lesson){const id=randomUUID();this.db.prepare('INSERT INTO lessons VALUES (?,?)').run(id,JSON.stringify(input));return id;}
  // Rooms keep their own copy of the lesson body, so deleting a saved lesson never affects sessions.
  deleteLesson(id:string){if(!this.db.prepare('DELETE FROM lessons WHERE id=?').run(id).changes)throw new Error('Lesson not found');}
  room(id:string):any {const row=this.db.prepare('SELECT * FROM rooms WHERE id=? OR code=?').get(id,id);if(!row)throw new Error('Room not found');return row;}
  create(lessonId:string){
    const lesson=this.db.prepare('SELECT body FROM lessons WHERE id=?').get(lessonId);
    if(!lesson)throw new Error('Lesson not found');
    let code:string;do{code=String(randomInt(100000,1000000));}while(this.db.prepare('SELECT id FROM rooms WHERE code=?').get(code));
    const id=randomUUID();this.db.prepare('INSERT INTO rooms(id,code,lesson,updated) VALUES(?,?,?,?)').run(id,code,lesson.body as string,Date.now());return id;
  }
  join(code:string,credential?:string){
    const room=this.room(code);
    if(room.phase==='ENDED')throw new Error('Session has ended');
    if(credential && this.db.prepare('SELECT token FROM participants WHERE token=? AND room=?').get(credential,room.id))return {id:room.id,credential};
    const token=randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO participants VALUES(?,?)').run(token,room.id);
    return {id:room.id,credential:token};
  }
  verify(id:string,token:string){if(!this.db.prepare('SELECT token FROM participants WHERE room=? AND token=?').get(id,token))throw new Error('Join the room first');}
  action(id:string,action:Action){
    const r=this.room(id), lesson:Lesson=JSON.parse(r.lesson);
    if(r.phase==='ENDED')throw new Error('Session has ended');
    let index=r.idx,phase=r.phase;
    const visited:string[]=JSON.parse(r.visited),revealed:string[]=JSON.parse(r.revealed),closed:string[]=JSON.parse(r.closed);
    if(action==='END'){phase='ENDED';this.lessons.delete(r.id);}
    else if(action==='REVEAL'){
      if(index<0||lesson.steps[index].type!=='question')throw new Error('No active question');
      if(!revealed.includes(lesson.steps[index].id))revealed.push(lesson.steps[index].id);
      phase='REVEALED';
    }else{
      if(action==='START'){if(index!==-1)throw new Error('Already started');index=0;}
      else if(action==='NEXT'){if(index<0||index>=lesson.steps.length-1)throw new Error('Cannot advance');index++;}
      else if(action==='PREVIOUS'){if(index<=0)throw new Error('Cannot go back');index--;}
      else throw new Error('Unknown action');
      if(r.idx>=0 && index!==r.idx && !closed.includes(lesson.steps[r.idx].id))closed.push(lesson.steps[r.idx].id);
      phase=revealed.includes(lesson.steps[index].id)?'REVEALED':'ACTIVE';
      if(!visited.includes(lesson.steps[index].id))visited.push(lesson.steps[index].id);
    }
    const at=Date.now();
    this.db.prepare('UPDATE rooms SET idx=?,phase=?,visited=?,revealed=?,closed=?,revision=revision+1,updated=?,started=COALESCE(started,?),ended=? WHERE id=?').run(index,phase,JSON.stringify(visited),JSON.stringify(revealed),JSON.stringify(closed),at,action==='START'?at:null,phase==='ENDED'?at:null,r.id);
  }
  vote(id:string,token:string,question:string,option:string,revision:number){
    this.verify(id,token);
    const r=this.room(id),lesson:Lesson=JSON.parse(r.lesson),step=lesson.steps[r.idx];
    const old=this.db.prepare('SELECT option FROM answers WHERE room=? AND participant=? AND question=?').get(id,token,question);
    if(old){if(old.option!==option)throw new Error('An answer is already recorded');return old.option;}
    if(r.phase!=='ACTIVE'||r.revision!==revision||step?.type!=='question'||step.id!==question)throw new Error('Question is closed or has changed');
    // Leaving a question permanently closes it, even when revisited.
    if(JSON.parse(r.closed).includes(question))throw new Error('Question is closed');
    if(!step.options.some(o=>o.id===option))throw new Error('Invalid option');
    this.db.prepare('INSERT INTO answers VALUES(?,?,?,?)').run(id,token,question,option);
    this.db.prepare('UPDATE rooms SET updated=? WHERE id=?').run(Date.now(),id);
    return option;
  }
  // A room's lesson never changes after creation, so parse it once.
  private lessons=new Map<string,Lesson>();
  private lessonOf(r:{id:string;lesson:string}):Lesson{let l=this.lessons.get(r.id);if(!l){l=JSON.parse(r.lesson) as Lesson;this.lessons.set(r.id,l);}return l;}
  // Everything a broadcast needs, computed once per room rather than once per screen:
  // the teacher view, the shared student/display view, and each student's own answer.
  views(id:string){
    const r=this.room(id),lesson=this.lessonOf(r),source=lesson.steps[r.idx];
    const revealed=!!source&&JSON.parse(r.revealed).includes(source.id);
    let step:any=source?{...source}:undefined;
    if(step?.type==='question'&&!revealed){delete step.correctOptionId;delete step.explanation;}
    const rows=source?this.db.prepare('SELECT option,COUNT(*) AS n FROM answers WHERE room=? AND question=? GROUP BY option').all(r.id,source.id):[];
    const totals=Object.fromEntries(rows.map(row=>[row.option,Number(row.n)]));
    const base:Snapshot={id:r.id,code:r.code,title:lesson.title,phase:r.phase,revision:r.revision,index:r.idx,stepCount:lesson.steps.length,step,participants:Number(this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE room=?').get(r.id)!.n),closed:r.phase!=='ACTIVE'||!!source&&JSON.parse(r.closed).includes(source.id),totals:revealed?totals:undefined,joinUrl:`${this.baseUrl}/join?code=${r.code}`,startedAt:r.started??undefined,endedAt:r.ended??undefined,serverNow:Date.now()};
    const teacher:Snapshot={...base,responses:rows.reduce((n,row)=>n+Number(row.n),0)};
    let answers:Map<string,string>|undefined;
    const answerOf=(token:string)=>{
      if(!source)return undefined;
      answers??=new Map(this.db.prepare('SELECT participant,option FROM answers WHERE room=? AND question=?').all(r.id,source.id).map(row=>[row.participant as string,row.option as string]));
      return answers.get(token);
    };
    return {teacher,base,student:(token:string):Snapshot=>{const answer=answerOf(token);return answer?{...base,answer}:base;}};
  }
  snapshot(id:string,teacher=false,token?:string):Snapshot {
    const v=this.views(id);
    return teacher?v.teacher:token?v.student(token):v.base;
  }
  // Students may download the full lesson (answers included) only after the session ends.
  handout(key:string,teacher:boolean,credential?:string):Handout {
    const r=this.room(key),lesson:Lesson=JSON.parse(r.lesson);
    const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
    if(!teacher){
      if(!credential||!this.db.prepare('SELECT token FROM participants WHERE token=? AND room=?').get(credential,r.id))throw fail(403,'Only participants in this session can download its handout');
      if(r.phase!=='ENDED')throw fail(409,'The handout is available once your teacher ends the session');
      const rows=this.db.prepare('SELECT question,option FROM answers WHERE room=? AND participant=?').all(r.id,credential);
      return {lesson,code:r.code,ended:true,answers:Object.fromEntries(rows.map(row=>[row.question as string,row.option as string]))};
    }
    const totals:Record<string,Record<string,number>>={};
    for(const row of this.db.prepare('SELECT question,option,COUNT(*) AS n FROM answers WHERE room=? GROUP BY question,option').all(r.id))(totals[row.question as string]??={})[row.option as string]=Number(row.n);
    return {lesson,code:r.code,ended:r.phase==='ENDED',totals};
  }
  sessions():SessionSummary[]{
    return this.db.prepare("SELECT r.id,r.code,r.phase,r.idx,r.lesson,r.updated,(SELECT COUNT(*) FROM participants p WHERE p.room=r.id) AS n FROM rooms r WHERE r.phase!='ENDED' ORDER BY r.updated DESC").all().map(r=>{
      const lesson:Lesson=JSON.parse(r.lesson as string);
      return {id:r.id as string,code:r.code as string,phase:r.phase as SessionSummary['phase'],title:lesson.title,index:Number(r.idx),stepCount:lesson.steps.length,participants:Number(r.n),updated:Number(r.updated)};
    });
  }
  endAll():string[]{
    const ids=this.sessions().map(s=>s.id);
    this.lessons.clear();
    const at=Date.now();
    this.db.prepare("UPDATE rooms SET phase='ENDED',revision=revision+1,updated=?,ended=? WHERE phase!='ENDED'").run(at,at);
    return ids;
  }
  // An idle session counts as ended at its last activity.
  expire(ms:number){this.lessons.clear();this.db.prepare("UPDATE rooms SET phase='ENDED',revision=revision+1,ended=updated WHERE phase!='ENDED' AND updated<?").run(Date.now()-ms);}
}
