import {useState} from 'react';
import type {LessonImage as Image} from '../shared/contracts.js';

// Tapping the image opens it full size, which matters for X-rays and ECGs on phones.
export function LessonImage({image,compact=false}:{image:Image;compact?:boolean}){
  const [failed,setFailed]=useState(false);
  return <figure className={compact?'lesson-image compact':'lesson-image'}>
    {failed
      ?<p role="alert" className="image-error">Image unavailable: {image.alt}</p>
      :<a href={image.src} target="_blank" rel="noreferrer" aria-label={`Open full-size image: ${image.alt}`}>
        <img src={image.src} alt={image.alt} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
      </a>}
    {image.caption&&<figcaption>{image.caption}</figcaption>}
  </figure>;
}
