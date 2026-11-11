import {backup} from 'node:sqlite';
import {describe,it,expect} from 'vitest';
import {Store} from '../src/server/store.js';
import {parseLesson} from '../src/server/validation.js';
import fixture from '../examples/intro.json' with {type:'json'};
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
describe('durable rooms',()=>{
  it('restores a consistent online backup',async()=>{
    const dir=mkdtempSync(join(tmpdir(),'backup-'));
    const source=new Store(join(dir,'source.sqlite'));
    const id=source.create(source.lesson(parseLesson(fixture)));
    source.action(id,'START');
    await backup(source.db,join(dir,'backup.sqlite'));
    const restored=new Store(join(dir,'backup.sqlite'));
    expect(restored.snapshot(id).index).toBe(0);
    restored.db.close();source.db.close();rmSync(dir,{recursive:true});
  });
  it('validates uploads and answer references',()=>{
    expect(()=>parseLesson({...fixture,schemaVersion:2})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[fixture.steps[0],fixture.steps[0]]})).toThrow('unique');
    const bad=structuredClone(fixture);(bad.steps[2] as any).correctOptionId='missing';
    expect(()=>parseLesson(bad)).toThrow('reference');
  });
  it('persists progress, validates votes, isolates rooms and never reopens questions',()=>{
    const dir=mkdtempSync(join(tmpdir(),'lesson-')),path=join(dir,'test.sqlite');
    let store=new Store(path);
    try{
      const lesson=store.lesson(parseLesson(fixture)),room=store.create(lesson),other=store.create(lesson);
      expect(store.snapshot(room).code).toMatch(/^\d{6}$/);
      const p=store.join(store.snapshot(room).code),p2=store.join(store.snapshot(room).code);
      expect(store.join(store.snapshot(room).code,p.credential).credential).toBe(p.credential);
      store.action(room,'START');store.action(room,'NEXT');store.action(room,'NEXT');
      const revision=store.snapshot(room).revision;
      expect(store.snapshot(room).step).not.toHaveProperty('correctOptionId');
      expect(()=>store.vote(room,p.credential,'q1','a',revision-1)).toThrow();
      expect(()=>store.vote(other,p.credential,'q1','a',revision)).toThrow();
      expect(()=>store.vote(room,p.credential,'q1','invalid',revision)).toThrow();
      store.vote(room,p.credential,'q1','a',revision);
      store.vote(room,p.credential,'q1','a',revision);
      expect(()=>store.vote(room,p.credential,'q1','b',revision)).toThrow('already');
      expect(store.snapshot(room).responses).toBeUndefined();
      expect(store.snapshot(room,true).responses).toBe(1);
      store.db.close();store=new Store(path);
      expect(store.snapshot(room,false,p.credential).answer).toBe('a');
      store.action(room,'PREVIOUS');store.action(room,'NEXT');
      expect(()=>store.vote(room,p2.credential,'q1','a',store.snapshot(room).revision)).toThrow('closed');
      store.action(room,'REVEAL');
      expect(store.snapshot(room).totals).toEqual({a:1});
      expect(store.snapshot(room).step).toHaveProperty('correctOptionId','a');
      expect(store.snapshot(other).phase).toBe('WAITING');
      store.action(room,'END');expect(()=>store.join(store.snapshot(room).code)).toThrow('ended');
    }finally{store.db.close();rmSync(dir,{recursive:true});}
  });
  it('deletes a saved lesson without affecting sessions started from it',()=>{
    const dir=mkdtempSync(join(tmpdir(),'delete-')),store=new Store(join(dir,'test.sqlite'));
    try{
      const lesson=store.lesson(parseLesson(fixture)),keep=store.lesson(parseLesson(fixture)),room=store.create(lesson);
      store.action(room,'START');
      store.deleteLesson(lesson);
      expect(store.db.prepare('SELECT id FROM lessons').all().map(r=>r.id)).toEqual([keep]);
      expect(()=>store.create(lesson)).toThrow('Lesson not found');
      expect(()=>store.deleteLesson(lesson)).toThrow('Lesson not found');
      store.action(room,'NEXT');
      expect(store.snapshot(room)).toMatchObject({title:fixture.title,index:1,phase:'ACTIVE'});
    }finally{store.db.close();rmSync(dir,{recursive:true});}
  });
  it('gives students the handout only after the session ends, with their own answers',()=>{
    const dir=mkdtempSync(join(tmpdir(),'handout-')),store=new Store(join(dir,'test.sqlite'));
    try{
      const room=store.create(store.lesson(parseLesson(fixture))),code=store.snapshot(room).code;
      const p=store.join(code),p2=store.join(code),outsider=store.join(store.snapshot(store.create(store.lesson(parseLesson(fixture)))).code);
      store.action(room,'START');store.action(room,'NEXT');store.action(room,'NEXT');
      const revision=store.snapshot(room).revision;
      store.vote(room,p.credential,'q1','a',revision);store.vote(room,p2.credential,'q1','b',revision);
      expect(()=>store.handout(code,false,p.credential)).toThrow('once your teacher ends the session');
      expect(store.handout(room,true)).toMatchObject({code,ended:false,totals:{q1:{a:1,b:1}}});
      store.action(room,'END');
      expect(()=>store.handout(code,false)).toThrow('Only participants');
      expect(()=>store.handout(code,false,outsider.credential)).toThrow('Only participants');
      const handout=store.handout(code,false,p.credential);
      expect(handout).toMatchObject({code,ended:true,answers:{q1:'a'}});
      expect(handout).not.toHaveProperty('totals');
      expect(handout.lesson.steps).toHaveLength(fixture.steps.length);
      expect(handout.lesson.steps[2]).toMatchObject({correctOptionId:'a',explanation:fixture.steps[2].explanation});
    }finally{store.db.close();rmSync(dir,{recursive:true});}
  });
  it('lists unended sessions with their lesson, step and students',()=>{
    const dir=mkdtempSync(join(tmpdir(),'sessions-')),store=new Store(join(dir,'test.sqlite'));
    try{
      const lesson=store.lesson(parseLesson(fixture)),a=store.create(lesson),b=store.create(lesson);
      store.join(store.snapshot(a).code);store.action(a,'START');store.action(a,'NEXT');
      expect(store.sessions()).toEqual([
        expect.objectContaining({id:a,phase:'ACTIVE',title:fixture.title,index:1,stepCount:fixture.steps.length,participants:1}),
        expect.objectContaining({id:b,phase:'WAITING',index:-1,participants:0}),
      ]);
      store.action(b,'END');
      expect(store.sessions().map(s=>s.id)).toEqual([a]);
      expect(store.endAll()).toEqual([a]);
      expect(store.sessions()).toEqual([]);
      expect(store.snapshot(a).phase).toBe('ENDED');
    }finally{store.db.close();rmSync(dir,{recursive:true});}
  });
  it('records when a session starts and ends for the session clock',()=>{
    const dir=mkdtempSync(join(tmpdir(),'clock-')),store=new Store(join(dir,'test.sqlite'));
    try{
      const room=store.create(store.lesson(parseLesson(fixture)));
      expect(store.snapshot(room)).toMatchObject({startedAt:undefined,endedAt:undefined});
      const before=Date.now();store.action(room,'START');
      const started=store.snapshot(room).startedAt!;
      expect(started).toBeGreaterThanOrEqual(before);
      store.action(room,'NEXT');store.action(room,'PREVIOUS');
      expect(store.snapshot(room).startedAt).toBe(started);
      expect(store.snapshot(room).endedAt).toBeUndefined();
      store.action(room,'END');
      expect(store.snapshot(room,true).endedAt).toBeGreaterThanOrEqual(started);
      expect(Math.abs(store.snapshot(room).serverNow-Date.now())).toBeLessThan(1000);
    }finally{store.db.close();rmSync(dir,{recursive:true});}
  });
});
