import {useEffect} from 'react';
import type {Action,Snapshot} from '../shared/contracts.js';
import {ControlIcon} from './ControlIcon.js';
import {SlideNavigation} from './SlideNavigation.js';

export function SessionControls({state,connected,onCommand}:{state:Snapshot;connected:boolean;onCommand:(action:Action,index?:number)=>void}){
  const running=state.phase==='ACTIVE'||state.phase==='REVEALED';
  useEffect(()=>{
    if(!connected||!running)return;
    const navigate=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const target=event.target;
      if(target instanceof Element&&target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],video,audio'))return;
      const action=event.key==='ArrowLeft'&&state.index>0?'PREVIOUS':event.key==='ArrowRight'&&state.index<state.stepCount-1?'NEXT':undefined;
      if(action){event.preventDefault();onCommand(action);}
    };
    window.addEventListener('keydown',navigate);
    return()=>window.removeEventListener('keydown',navigate);
  },[connected,running,state.index,state.stepCount,onCommand]);

  return <section className="teacher-controls" aria-label="Session controls">
    <div className="controls-toolbar">
      <div className="session-metrics">
        <span className="session-metric" role="img" aria-label={`${state.participants} participants`} title="Participants"><ControlIcon kind="team"/><strong>{state.participants}</strong></span>
        <span className="session-metric" role="img" aria-label={`${state.responses||0} responses`} title="Submitted responses"><ControlIcon kind="responses"/><strong>{state.responses||0}</strong></span>
      </div>
      <a className="icon-button secondary" target="_blank" rel="noreferrer" href={'/handout?room='+state.id} aria-label="Download lesson PDF" title="Download lesson PDF"><ControlIcon kind="pdf"/></a>
    </div>
    <nav aria-label="Slide navigation">
      {state.phase==='WAITING'?<button disabled={!connected} onClick={()=>onCommand('START')}>Begin lesson</button>:running&&<>
        <button disabled={!connected||state.index===0} onClick={()=>onCommand('PREVIOUS')} aria-keyshortcuts="ArrowLeft" title="Previous slide (←)"><ControlIcon kind="left"/>Previous</button>
        <button disabled={!connected||state.index>=state.stepCount-1} onClick={()=>onCommand('NEXT')} aria-keyshortcuts="ArrowRight" title="Next slide (→)">Next<ControlIcon kind="right"/></button>
        {state.step?.type==='question'&&<button disabled={!connected||state.phase==='REVEALED'} onClick={()=>onCommand('REVEAL')}>Reveal results</button>}
      </>}
    </nav>
    {running&&state.navigation&&<SlideNavigation index={state.index} steps={state.navigation} connected={connected} onJump={index=>onCommand('JUMP',index)}/>}
    {state.phase!=='ENDED'&&<button className="secondary end-session" disabled={!connected} onClick={()=>onCommand('END')}>End session</button>}
  </section>;
}
