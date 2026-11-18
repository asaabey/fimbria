const paths={
  team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  responses:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0ZM8 11l3 3 5-5',
  pdf:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M12 11v7M9 15l3 3 3-3',
  left:'M19 12H5M12 19l-7-7 7-7',
  right:'M5 12h14M12 5l7 7-7 7',
  jump:'M4 12h14M12 6l6 6-6 6M21 5v14',
};

export function ControlIcon({kind}:{kind:keyof typeof paths}){
  return <svg className="control-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]}/></svg>;
}
