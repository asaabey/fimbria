import {useEffect,useState} from 'react';
import {plainText} from './BodyText.js';

export function SlideNavigation({index,steps,connected,onJump}:{index:number;steps:{index:number;title:string}[];connected:boolean;onJump:(index:number)=>void}){
  const [selected,setSelected]=useState(index);
  useEffect(()=>setSelected(index),[index]);
  return <div className="slide-navigation">
    <label>Jump to slide
      <select value={selected} disabled={!connected} onChange={event=>setSelected(Number(event.target.value))}>
        {steps.map(step=><option key={step.index} value={step.index}>{step.index+1}. {plainText(step.title)}</option>)}
      </select>
    </label>
    <button className="secondary" disabled={!connected||selected===index} onClick={()=>onJump(selected)}>Go to slide</button>
  </div>;
}
