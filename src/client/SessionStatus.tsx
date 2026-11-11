// Compact session indicators for the top bar and title row.
export function PlugIcon({off=false}:{off?:boolean}){
  return <svg className="plug-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2v5M15 2v5M6 7h12v5a6 6 0 0 1-12 0V7ZM12 18v4"/>
    {off&&<path d="M3 3l18 18"/>}
  </svg>;
}

export function StepProgress({index,count}:{index:number;count:number}){
  if(index<0)return <p className="step-progress"><span>Lobby</span></p>;
  const step=Math.min(index+1,count);
  return <div className="step-progress">
    <span className="step-count">Step {step} of {count}</span>
    <div className="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuemin={1} aria-valuemax={count} aria-valuenow={step} aria-valuetext={`Step ${step} of ${count}`}>
      <span style={{width:`${step/count*100}%`}}/>
    </div>
  </div>;
}
