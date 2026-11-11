export type LessonImage = {src:string;alt:string;caption?:string};
export type LessonTable = {caption?:string;columns?:string[];rows:(string|number)[][];rowHeaders?:boolean};
export type Slide = {id:string;type:'slide';title:string;body:string;image?:LessonImage;table?:LessonTable};
export type Video = {id:string;type:'video';title:string;src:string;captionsSrc?:string};
export type Question = {id:string;type:'question';prompt:string;options:{id:string;text:string}[];correctOptionId:string;explanation:string;image?:LessonImage;table?:LessonTable};
export type Lesson = {schemaVersion:1;id:string;title:string;steps:(Slide|Video|Question)[]};
export type Action = 'START'|'NEXT'|'PREVIOUS'|'REVEAL'|'END';
export type Snapshot = {id:string;code:string;title:string;phase:'WAITING'|'ACTIVE'|'REVEALED'|'ENDED';revision:number;index:number;stepCount:number;step?:Slide|Video|Omit<Question,'correctOptionId'|'explanation'> & {correctOptionId?:string;explanation?:string};participants:number;responses?:number;answer?:string;closed:boolean;totals?:Record<string,number>;joinUrl:string};
export type Reply<T=unknown> = {ok:true;data:T}|{ok:false;error:string};
// Printable lesson handout. Teachers get vote totals for a session; a student gets their own answers.
export type Handout = {lesson:Lesson;code?:string;ended?:boolean;answers?:Record<string,string>;totals?:Record<string,Record<string,number>>};
