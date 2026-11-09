import {useState} from 'react';
import type {Video} from '../shared/contracts.js';
import {youTubeEmbedUrl} from '../shared/video.js';

export function VideoPlayer({step}:{step:Video}){
  const [failed,setFailed]=useState(false);
  const embedUrl=youTubeEmbedUrl(step.src);
  if(embedUrl)return <div className="lesson-video">
    <iframe src={embedUrl} title={step.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
    <a href={step.src} target="_blank" rel="noopener">Watch on YouTube ↗</a>
  </div>;
  return <div className="lesson-video">
    <video controls playsInline preload="metadata" src={step.src} crossOrigin={step.captionsSrc?.startsWith('https://')?'anonymous':undefined} aria-label={step.title} onError={()=>setFailed(true)}>
      {step.captionsSrc&&<track kind="captions" src={step.captionsSrc} srcLang="en" label="English" default/>}
      Your browser does not support embedded video.
    </video>
    {failed&&<p role="alert">Unable to load this video. Check that the MP4 link is accessible.</p>}
    <a href={step.src} target="_blank" rel="noreferrer">Open video in a new tab ↗</a>
  </div>;
}
