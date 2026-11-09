import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync} from 'node:crypto';
const password=process.env.TEACHER_PASSWORD;
if(!password||password.length<12)throw new Error('TEACHER_PASSWORD must contain at least 12 characters');
const db=new DatabaseSync(process.env.DB_PATH||'data/app.sqlite');
const salt=randomBytes(16).toString('hex');
db.prepare('INSERT INTO teacher VALUES(1,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash').run(salt+':'+scryptSync(password,salt,64).toString('hex'));
db.exec('DELETE FROM auth');db.close();console.log('Teacher password set; sessions revoked.');
