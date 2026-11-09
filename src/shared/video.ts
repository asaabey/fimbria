const youtubeHosts=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be','youtube-nocookie.com','www.youtube-nocookie.com']);

export function isYouTubeUrl(value:string):boolean {
  try {return youtubeHosts.has(new URL(value).hostname);} catch {return false;}
}

export function youTubeEmbedUrl(value:string):string|undefined {
  let url:URL;
  try {url=new URL(value);} catch {return;}
  if(!youtubeHosts.has(url.hostname)||url.protocol!=='https:'||url.username||url.password||url.port)return;
  const parts=url.pathname.split('/').filter(Boolean);
  let id:string|undefined;
  if(url.hostname==='youtu.be'||url.hostname==='www.youtu.be'){
    if(parts.length===1)id=parts[0];
  }else if(url.pathname==='/watch'){
    id=url.searchParams.get('v')||undefined;
  }else if(parts.length===2&&['embed','shorts','live'].includes(parts[0])){
    id=parts[1];
  }
  if(!id||!/^[a-zA-Z0-9_-]{11}$/.test(id))return;
  const embed=new URL(`https://www.youtube.com/embed/${id}`);
  embed.searchParams.set('playsinline','1');
  const time=url.searchParams.get('start')??url.searchParams.get('t')??new URLSearchParams(url.hash.slice(1)).get('t');
  if(time){
    const match=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);
    const seconds=/^\d+$/.test(time)?Number(time):match?Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0):0;
    if(Number.isSafeInteger(seconds)&&seconds>0)embed.searchParams.set('start',String(seconds));
  }
  return embed.href;
}
