import {Store} from '../src/server/store.js';
import {hashPassword} from '../src/server/auth.js';
const password=process.env.TEACHER_PASSWORD;
if(!password||password.length<12)throw new Error('Set TEACHER_PASSWORD to at least 12 characters');
const store=new Store(process.env.DB_PATH||'data/app.sqlite');
store.db.prepare('INSERT INTO teacher VALUES(1,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash').run(hashPassword(password));
store.db.exec('DELETE FROM auth');store.db.close();console.log('Teacher password set; all login sessions revoked.');
