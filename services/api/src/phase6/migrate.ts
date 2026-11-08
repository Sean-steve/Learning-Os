import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
const {Client}=pg;
const sql=readFileSync(fileURLToPath(new URL('../../migrations/001_phase6.sql',import.meta.url)),'utf8');
const connectionString=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!connectionString)throw new Error('Set MIGRATION_DATABASE_URL (preferred) or DATABASE_URL explicitly.');
const client=new Client({connectionString});
try {await client.connect();await client.query(sql);console.log('Learning OS migration 001 applied');} catch(e){console.error(e);process.exitCode=1;}finally{await client.end();}
