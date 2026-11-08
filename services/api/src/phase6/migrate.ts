import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
const {Client}=pg;
const scripts=['001_phase6.sql','002_phase71_identity.sql'].map(file=>readFileSync(fileURLToPath(new URL('../../migrations/'+file,import.meta.url)),'utf8'));
const connectionString=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
if(!connectionString)throw new Error('Set MIGRATION_DATABASE_URL (preferred) or DATABASE_URL explicitly.');
const client=new Client({connectionString});
try {await client.connect();for(let i=0;i<scripts.length;i++){await client.query(scripts[i]);console.log('Learning OS migration '+(i+1)+' applied')}} catch(e){console.error(e);process.exitCode=1;}finally{await client.end();}
