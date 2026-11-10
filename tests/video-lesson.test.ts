import {describe,it,expect} from 'vitest';
import {parseLesson} from '../src/server/validation.js';
import {Store} from '../src/server/store.js';
import fixture from '../examples/intro.json' with {type:'json'};

const video={id:'video',type:'video',title:'Gradient animation',src:'/media/gradient.mp4',captionsSrc:'/media/gradient.en.vtt'};
const lesson={...fixture,steps:[video,fixture.steps[2]]};

describe('video lessons',()=>{
  it('accepts local and HTTPS media, and rejects unsafe or incomplete sources',()=>{
    expect(parseLesson(lesson).steps[0]).toEqual(video);
    expect(()=>parseLesson({...lesson,steps:[{...video,src:'https://cdn.example.com/gradient.mp4?version=1'}]})).not.toThrow();
    for(const src of ['', 'javascript:alert(1)', 'data:video/mp4;base64,abc', '//example.com/a.mp4', '/\\example.com/a.mp4', 'file:///tmp/a.mp4', 'https://user:password@example.com/a.mp4', '/media/a\nb.mp4', 'relative.mp4']){
      expect(()=>parseLesson({...lesson,steps:[{...video,src}]})).toThrow();
    }
    expect(()=>parseLesson({...lesson,steps:[{...video,captionsSrc:'javascript:alert(1)'}]})).toThrow();
    const {title,...missingTitle}=video;
    expect(()=>parseLesson({...lesson,steps:[missingTitle]})).toThrow();
  });

  it('shares the video step and transitions to a question without allowing votes on video',()=>{
    const store=new Store(':memory:');
    try {
      const room=store.create(store.lesson(parseLesson(lesson)));
      const participant=store.join(store.snapshot(room).code);
      store.action(room,'START');
      const snapshot=store.snapshot(room,false,participant.credential);
      expect(snapshot.step).toEqual(video);
      expect(()=>store.vote(room,participant.credential,'video','a',snapshot.revision)).toThrow();
      expect(()=>store.action(room,'REVEAL')).toThrow('No active question');
      store.action(room,'NEXT');
      expect(store.snapshot(room).step?.type).toBe('question');
      store.vote(room,participant.credential,'q1','a',store.snapshot(room).revision);
      store.action(room,'PREVIOUS');
      expect(store.snapshot(room).step).toEqual(video);
    } finally {store.db.close();}
  });
});

describe('step images',()=>{
  const image={src:'/media/sample-ecg-strip.svg',alt:'Rhythm strip with peaked T waves',caption:'Lead II'};
  const slide={id:'s',type:'slide',title:'Look',body:'Study the strip.',image};
  const question={...fixture.steps[2],image:{src:'https://cdn.example.com/strip.png',alt:'Strip'}};
  it('accepts images on slides and questions and passes them through to the live step',()=>{
    const parsed=parseLesson({...fixture,steps:[slide,question]});
    expect(parsed.steps[0]).toEqual(slide);
    const store=new Store(':memory:');
    try{
      const room=store.create(store.lesson(parsed));
      store.action(room,'START');expect(store.snapshot(room).step).toEqual(slide);
      store.action(room,'NEXT');expect(store.snapshot(room).step).toMatchObject({image:question.image});
      expect(store.snapshot(room).step).not.toHaveProperty('correctOptionId');
    }finally{store.db.close();}
  });
  it('rejects unsafe sources, missing alt text, unknown fields and images on video steps',()=>{
    for(const src of ['javascript:alert(1)','data:image/png;base64,abc','//example.com/a.png','http://example.com/a.png','relative.png','']){
      expect(()=>parseLesson({...fixture,steps:[{...slide,image:{...image,src}}]})).toThrow();
    }
    const {alt,...noAlt}=image;
    expect(()=>parseLesson({...fixture,steps:[{...slide,image:noAlt}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,image:{...image,alt:''}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,image:{...image,width:300}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...video,image}]})).toThrow();
  });
  it('validates the bundled image example',async()=>{
    const example=(await import('../examples/images.json',{with:{type:'json'}})).default;
    expect(parseLesson(example).steps.every(s=>s.type!=='video'&&s.image)).toBe(true);
  });
});

describe('lesson format guide',()=>{
  it('documents every schema field and its complete examples are valid lessons',async()=>{
    const {readFile}=await import('node:fs/promises');
    const guide=await readFile('public/docs/lesson-format.md','utf8');
    const schema=JSON.parse(await readFile('schemas/lesson.schema.json','utf8'));
    const fields=new Set<string>();
    const walk=(node:any)=>{if(node&&typeof node==='object'){if(node.properties)for(const k of Object.keys(node.properties))fields.add(k);Object.values(node).forEach(walk);}};
    walk(schema);
    for(const field of fields)expect(guide,`guide should mention "${field}"`).toContain(`\`${field}\``);
    const lessons=[...guide.matchAll(/```json\n([\s\S]*?)```/g)].map(m=>m[1]).filter(block=>block.includes('"schemaVersion": 1')&&!block.includes('/*'));
    expect(lessons.length).toBeGreaterThan(0);
    for(const block of lessons)expect(()=>parseLesson(JSON.parse(block))).not.toThrow();
  });
});

describe('step tables',()=>{
  const table={caption:'Results',columns:['Test','Result'],rowHeaders:true,rows:[['Potassium','6.8 mmol/L'],['Creatinine',212]]};
  const slide={id:'s',type:'slide',title:'Results',body:'',table};
  it('accepts tables on slides and questions, with or without a header row, and passes them to the live step',()=>{
    const headerless={rows:[['a','b'],['c','d']]};
    const question={...fixture.steps[2],table:headerless};
    const parsed=parseLesson({...fixture,steps:[slide,question]});
    expect(parsed.steps[0]).toEqual(slide);
    const store=new Store(':memory:');
    try{
      const room=store.create(store.lesson(parsed));
      store.action(room,'START');expect(store.snapshot(room).step).toMatchObject({table});
      store.action(room,'NEXT');expect(store.snapshot(room).step).toMatchObject({table:headerless});
    }finally{store.db.close();}
  });
  it('rejects ragged rows, oversize tables, unknown fields and tables on video steps',()=>{
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,rows:[['Potassium']]}}]})).toThrow('must have 2 cells');
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{rows:[['a','b'],['c']]}}]})).toThrow('first row');
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,columns:Array(9).fill('c'),rows:[Array(9).fill('x')]}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,rows:Array(31).fill(['a','b'])}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,rows:[]}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,rows:[['a',{b:1}]]}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,rows:[['a','x'.repeat(201)]]}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...slide,table:{...table,align:'left'}}]})).toThrow();
    expect(()=>parseLesson({...fixture,steps:[{...video,table}]})).toThrow();
  });
  it('validates the bundled table example',async()=>{
    const example=(await import('../examples/tables.json',{with:{type:'json'}})).default;
    expect(parseLesson(example).steps.every(s=>s.type!=='video'&&s.table)).toBe(true);
  });
});
