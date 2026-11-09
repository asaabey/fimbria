export type Slide = {id:string;type:'slide';title:string;body:string};
export type Video = {id:string;type:'video';title:string;src:string;captionsSrc?:string};
export type Question = {id:string;type:'question';prompt:string;options:{id:string;text:string}[];correctOptionId:string;explanation:string};
export type Lesson = {schemaVersion:1;id:string;title:string;steps:(Slide|Video|Question)[]};
export type Action = 'START'|'NEXT'|'PREVIOUS'|'REVEAL'|'END';
export type Snapshot = {id:string;code:string;title:string;phase:'WAITING'|'ACTIVE'|'REVEALED'|'ENDED';revision:number;index:number;stepCount:number;step?:Slide|Video|Omit<Question,'correctOptionId'|'explanation'> & {correctOptionId?:string;explanation?:string};participants:number;responses?:number;answer?:string;closed:boolean;totals?:Record<string,number>;joinUrl:string};
export type Reply<T=unknown> = {ok:true;data:T}|{ok:false;error:string};
