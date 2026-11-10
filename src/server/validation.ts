import { Ajv } from 'ajv';
import schema from '../../schemas/lesson.schema.json' with {type:'json'};
import type {Lesson} from '../shared/contracts.js';
import {isYouTubeUrl,youTubeEmbedUrl} from '../shared/video.js';
const validate = new Ajv({allErrors:true}).compile(schema);
function validateMediaUrl(value:string, path:string){
  const base='https://lesson.invalid';
  let url:URL;
  try {url=new URL(value,base);} catch {throw new Error(`${path} must be a site-relative path or HTTPS URL`);}
  const local=value.startsWith('/')&&!value.startsWith('//')&&url.origin===base;
  const remote=value.startsWith('https://')&&url.protocol==='https:';
  if ((!local&&!remote)||url.username||url.password||/[\\\s]/.test(value)) {
    throw new Error(`${path} must be a site-relative path or HTTPS URL without credentials or whitespace`);
  }
}
export function parseLesson(input:unknown):Lesson {
  if (!validate(input)) throw new Error(validate.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; '));
  const lesson=input as Lesson;
  const ids=new Set<string>();
  lesson.steps.forEach((step,i)=>{
    if(ids.has(step.id)) throw new Error(`/steps/${i}/id must be unique`);
    ids.add(step.id);
    if(step.type==='video'){
      validateMediaUrl(step.src,`/steps/${i}/src`);
      if(isYouTubeUrl(step.src)){
        if(!youTubeEmbedUrl(step.src))throw new Error(`/steps/${i}/src must link to a single YouTube video (watch, share, Shorts, live or embed URL)`);
        if(step.captionsSrc)throw new Error(`/steps/${i}/captionsSrc is only supported for MP4 videos; use YouTube's captions for YouTube videos`);
      }
      if(step.captionsSrc)validateMediaUrl(step.captionsSrc,`/steps/${i}/captionsSrc`);
    }
    if(step.type!=='video'&&step.image)validateMediaUrl(step.image.src,`/steps/${i}/image/src`);
    if(step.type!=='video'&&step.table){
      const width=step.table.columns?.length??step.table.rows[0].length;
      step.table.rows.forEach((row,r)=>{if(row.length!==width)throw new Error(`/steps/${i}/table/rows/${r} must have ${width} cells to match ${step.table!.columns?'the columns':'the first row'}`);});
    }
    if(step.type==='question'){
      if(new Set(step.options.map(o=>o.id)).size!==step.options.length) throw new Error(`/steps/${i}/options IDs must be unique`);
      if(!step.options.some(o=>o.id===step.correctOptionId)) throw new Error(`/steps/${i}/correctOptionId must reference an option`);
    }
  });
  return lesson;
}
