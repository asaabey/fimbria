import {useEffect,useState} from 'react';
import {plainText} from './BodyText.js';
import {ControlIcon} from './ControlIcon.js';

export function SlideNavigation({index,steps,connected,onJump}:{index:number;steps:{index:number;title:string}[];connected:boolean;onJump:(index:number)=>void}){
  const [selected,setSelected]=useState(index);
  useEffect(()=>setSelected(index),[index]);
  return <div className="slide-navigation">
      <select aria-label="Jump to slide" title="Jump to slide" value={selected} disabled={!connected} onChange={event=>setSelected(Number(event.target.value))}>
        {steps.map(step=><option key={step.index} value={step.index}>{step.index+1}. {plainText(step.title)}</option>)}
      </select>
    <button className="secondary icon-button" aria-label="Go to slide" title="Go to selected slide" disabled={!connected||selected===index} onClick={()=>onJump(selected)}><ControlIcon kind="jump"/></button>
  </div>;
}
