import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
const {Client}=pg;
const sql=readFileSync(fileURLToPath(new URL('../../migrations/001_phase6.sql',import.meta.url)),'utf8');
const client=new Client({connectionString:process.env.DATABASE_URL||'postgres://learning_os:learning_os_local@127.0.0.1:5432/learning_os'});
try {await client.connect();await client.query(sql);console.log('Learning OS migration 001 applied');} catch(e){console.error(e);process.exitCode=1;}finally{await client.end();}
