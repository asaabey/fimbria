import type {ReactNode} from 'react';

// Inline emphasis: **bold** and ==highlight==. The markers must hug the text ("a == b" stays literal),
// unmatched markers stay as typed. Named [marker], [underline] and [fade] pairs add text effects.
// Different markers can nest. Output is React elements, never HTML.
const inline=/\*\*(?=\S)(.+?)(?<=\S)\*\*|==(?=\S)(.+?)(?<=\S)==|\[(marker|underline|fade)\](?=\S)(.+?)(?<=\S)\[\/\3\]/g;
export function emphasis(text:string):ReactNode[]{
  const out:ReactNode[]=[];let last=0;
  for(const m of text.matchAll(inline)){
    if(m.index>last)out.push(text.slice(last,m.index));
    const content=emphasis(m[1]??m[2]??m[4]);
    out.push(m[1]!==undefined?<strong key={m.index}>{content}</strong>:m[2]!==undefined?<mark key={m.index}>{content}</mark>:m[3]==='marker'?<mark className="text-marker" key={m.index}>{content}</mark>:<span className={`text-${m[3]}`} key={m.index}>{content}</span>);
    last=m.index+m[0].length;
  }
  if(last<text.length)out.push(text.slice(last));
  return out;
}

// Slide bodies and explanations are plain text, but authors naturally write lists.
// Consecutive lines starting with "- ", "* " or "• " become a bulleted list, and lines
// starting with "1. " or "1) " a numbered list. Everything else keeps its line breaks.
// Within any line, **bold** and ==highlight== mark words that should stand out.
const bullet=/^\s*[-*•–]\s+(.*)$/,numbered=/^\s*(\d{1,3})[.)]\s+(.*)$/;

export function BodyText({text,className='body',compact=false}:{text:string;className?:string;compact?:boolean}){
  const blocks:ReactNode[]=[];
  let prose:string[]=[],items:string[]=[],kind:'ul'|'ol'|undefined,start=1;
  const flushProse=()=>{const value=prose.join('\n').replace(/^\n+|\n+$/g,'');if(value)blocks.push(<p key={blocks.length}>{emphasis(value)}</p>);prose=[];};
  const flushList=()=>{
    if(!kind)return;
    const list=items.map((item,i)=><li key={i}>{emphasis(item)}</li>);
    blocks.push(kind==='ul'?<ul key={blocks.length}>{list}</ul>:<ol key={blocks.length} start={start}>{list}</ol>);
    items=[];kind=undefined;
  };
  for(const line of text.split('\n')){
    const b=bullet.exec(line),n=b?null:numbered.exec(line);
    const next=b?'ul':n?'ol':undefined;
    if(!next){flushList();prose.push(line);continue;}
    if(next!==kind){flushProse();flushList();kind=next;start=n?Number(n[1]):1;}
    items.push(b?b[1]:n![2]);
  }
  flushProse();flushList();
  return <div className={compact?`${className} compact`:className}>{blocks}</div>;
}
