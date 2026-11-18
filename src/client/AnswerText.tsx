import {InlineText} from './BodyText.js';

// Keep the same elements before/after reveal so existing author effects do not restart.
export function AnswerText({text,correct=false}:{text:string;correct?:boolean}){
  return <span className={correct?'option-text correct-answer-text':'option-text'}><InlineText text={text}/></span>;
}
