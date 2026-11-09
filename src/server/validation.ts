import { Ajv } from 'ajv';
import schema from '../../schemas/lesson.schema.json' with {type:'json'};
import type {Lesson} from '../shared/contracts.js';
const validate = new Ajv({allErrors:true}).compile(schema);
export function parseLesson(input:unknown):Lesson {
  if (!validate(input)) throw new Error(validate.errors?.map(e => `${e.instancePath || '/'} ${e.message}`).join('; '));
  const lesson=input as Lesson;
  const ids=new Set<string>();
  lesson.steps.forEach((step,i)=>{
    if(ids.has(step.id)) throw new Error(`/steps/${i}/id must be unique`);
    ids.add(step.id);
    if(step.type==='question'){
      if(new Set(step.options.map(o=>o.id)).size!==step.options.length) throw new Error(`/steps/${i}/options IDs must be unique`);
      if(!step.options.some(o=>o.id===step.correctOptionId)) throw new Error(`/steps/${i}/correctOptionId must reference an option`);
    }
  });
  return lesson;
}
