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
