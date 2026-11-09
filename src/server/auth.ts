import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function checkPassword(password:string,hash:string){const [salt,key]=hash.split(':');const actual=scryptSync(password,salt,64);return timingSafeEqual(actual,Buffer.from(key,'hex'));}
