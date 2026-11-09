import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import type {Action,Lesson,Snapshot} from '../shared/contracts.js';
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
  }
  lesson(input:Lesson){const id=randomUUID();this.db.prepare('INSERT INTO lessons VALUES (?,?)').run(id,JSON.stringify(input));return id;}
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
    if(action==='END')phase='ENDED';
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
    this.db.prepare('UPDATE rooms SET idx=?,phase=?,visited=?,revealed=?,closed=?,revision=revision+1,updated=? WHERE id=?').run(index,phase,JSON.stringify(visited),JSON.stringify(revealed),JSON.stringify(closed),Date.now(),r.id);
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
  snapshot(id:string,teacher=false,token?:string):Snapshot {
    const r=this.room(id),lesson:Lesson=JSON.parse(r.lesson),source=lesson.steps[r.idx];
    const revealed=source && JSON.parse(r.revealed).includes(source.id);
    let step:any=source?{...source}:undefined;
    if(step?.type==='question'&&!revealed){delete step.correctOptionId;delete step.explanation;}
    const rows=source?this.db.prepare('SELECT option,COUNT(*) AS n FROM answers WHERE room=? AND question=? GROUP BY option').all(r.id,source.id):[];
    const totals=Object.fromEntries(rows.map(row=>[row.option,Number(row.n)]));
    const answer=token&&source?this.db.prepare('SELECT option FROM answers WHERE room=? AND participant=? AND question=?').get(r.id,token,source.id)?.option as string|undefined:undefined;
    return {id:r.id,code:r.code,title:lesson.title,phase:r.phase,revision:r.revision,index:r.idx,stepCount:lesson.steps.length,step,participants:Number(this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE room=?').get(r.id)!.n),responses:teacher?rows.reduce((n,row)=>n+Number(row.n),0):undefined,answer:answer||undefined,closed:r.phase!=='ACTIVE'||!!source&&JSON.parse(r.closed).includes(source.id),totals:revealed?totals:undefined,joinUrl:`${this.baseUrl}/join?code=${r.code}`};
  }
  expire(ms:number){this.db.prepare("UPDATE rooms SET phase='ENDED',revision=revision+1 WHERE phase!='ENDED' AND updated<?").run(Date.now()-ms);}
}
