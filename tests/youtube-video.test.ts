import {describe,it,expect} from 'vitest';
import {isYouTubeUrl,youTubeEmbedUrl} from '../src/shared/video.js';
import {parseLesson} from '../src/server/validation.js';

const id='M7lc1UVf-VE';
const embed=`https://www.youtube.com/embed/${id}?playsinline=1`;
const lesson=(src:string,captionsSrc?:string)=>({schemaVersion:1,id:'youtube',title:'YouTube lesson',steps:[{id:'clip',type:'video',title:'An explanation',src,...(captionsSrc?{captionsSrc}:{})}]});

describe('YouTube video sources',()=>{
  it.each([
    `https://www.youtube.com/watch?v=${id}&list=example`,
    `https://youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=tracking`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ])('normalizes %s to a single embedded video',src=>{
    expect(youTubeEmbedUrl(src)).toBe(embed);
    expect(parseLesson(lesson(src)).steps[0]).toHaveProperty('src',src);
  });

  it.each(['t=90','t=1m30s','start=90'])('preserves %s',time=>{
    expect(youTubeEmbedUrl(`https://youtu.be/${id}?${time}`)).toBe(embed+'&start=90');
  });

  it('preserves hour timestamps and removes arbitrary player parameters',()=>{
    expect(youTubeEmbedUrl(`https://youtu.be/${id}#t=1h2m3s`)).toBe(embed+'&start=3723');
    expect(youTubeEmbedUrl(`https://youtu.be/${id}?autoplay=1&origin=https://evil.example&t=bad`)).toBe(embed);
  });

  it.each([
    'https://youtube.com/playlist?list=example',
    'https://youtube.com/@channel',
    'https://youtube.com/watch?v=bad',
    'https://youtu.be/',
    `https://youtu.be/${id}/extra`,
    `https://youtube.com:444/embed/${id}`,
    `https://user:password@youtube.com/embed/${id}`,
    `http://youtube.com/watch?v=${id}`,
  ])('rejects unsupported YouTube source %s',src=>{
    expect(youTubeEmbedUrl(src)).toBeUndefined();
    expect(()=>parseLesson(lesson(src))).toThrow();
  });

  it('does not embed unrelated or lookalike hosts, or local media',()=>{
    for(const src of ['/media/video.mp4',`https://youtube.com.evil.example/watch?v=${id}`,`https://notyoutube.com/watch?v=${id}`]){
      expect(isYouTubeUrl(src)).toBe(false);
      expect(youTubeEmbedUrl(src)).toBeUndefined();
    }
  });

  it('directs teachers to YouTube captions instead of silently ignoring captionsSrc',()=>{
    expect(()=>parseLesson(lesson(`https://youtu.be/${id}`,'/media/captions.vtt'))).toThrow("use YouTube's captions");
  });
});
