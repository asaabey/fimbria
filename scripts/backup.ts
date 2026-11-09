import {DatabaseSync,backup} from 'node:sqlite';
const output=process.argv[2];if(!output)throw new Error('Usage: npm run backup -- /path/backup.sqlite');
const db=new DatabaseSync(process.env.DB_PATH||'data/app.sqlite');await backup(db,output);db.close();console.log('Backup completed');
