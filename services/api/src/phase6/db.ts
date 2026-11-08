import pg from 'pg';
import type { PoolClient } from 'pg';
import { validateRecord, parseRevision } from './core.ts';
const { Pool }=pg;
export const pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://learning_os:learning_os_local@127.0.0.1:5432/learning_os',max:10, connectionTimeoutMillis:4000, idleTimeoutMillis:10_000});
export type DB = InstanceType<typeof Pool>;
export async function withUser<T>(db:DB,userId:string,operation:(client:PoolClient)=>Promise<T>):Promise<T> {
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id',$1,true)",[userId]);
    const result=await operation(client);
    await client.query('COMMIT');return result;
  } catch(err){await client.query('ROLLBACK').catch(()=>{});throw err;}
  finally{client.release();}
}
export type StoredRow={key:string;data:unknown;revision:number;updatedAt:string};
export async function getRecords(db:DB,userId:string):Promise<StoredRow[]> {
  return withUser(db,userId,async client=>{
    const r=await client.query(`SELECT record_key AS key,data,revision,updated_at AS "updatedAt" FROM los_records WHERE user_id=$1 ORDER BY record_key`,[userId]);
    return r.rows as StoredRow[];
  });
}
export class VersionConflict extends Error {constructor(){super('revision_conflict');}}
export async function putRecord(db:DB,userId:string,key:string,data:unknown,revision:number):Promise<StoredRow> {
  validateRecord(key,data);parseRevision(revision);
  return withUser(db,userId,async client=>{
    const prev=await client.query('SELECT revision FROM los_records WHERE user_id=$1 AND record_key=$2 FOR UPDATE',[userId,key]);
    const previous=prev.rows.length?Number(prev.rows[0].revision):0;
    if(previous!==revision)throw new VersionConflict();
    const result= previous?await client.query(`UPDATE los_records SET data=$3::jsonb,revision=revision+1,updated_at=now() WHERE user_id=$1 AND record_key=$2 RETURNING record_key AS key,data,revision,updated_at AS "updatedAt"`,[userId,key,JSON.stringify(data)]):await client.query(`INSERT INTO los_records(user_id,record_key,data) VALUES($1,$2,$3::jsonb) RETURNING record_key AS key,data,revision,updated_at AS "updatedAt"`,[userId,key,JSON.stringify(data)]);
    return result.rows[0] as StoredRow;
  });
}
