/** Ephemeral CI database only; never provision production secrets here. */
import pg from 'pg';
if(process.env.CI!=='true')throw Error('CI-only role provisioning blocked outside CI');
if(!process.env.MIGRATION_DATABASE_URL?.includes('learning_os_test'))throw Error('Expected ephemeral learning_os_test admin connection');
const {Client}=pg;
const db=new Client({connectionString:process.env.MIGRATION_DATABASE_URL});
try{
 await db.connect();
 await db.query("CREATE ROLE los_app_ci LOGIN PASSWORD 'los_app_ci_test_only'");
 await db.query('GRANT CONNECT ON DATABASE learning_os_test TO los_app_ci');
 await db.query('GRANT USAGE ON SCHEMA public TO los_app_ci');
 await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO los_app_ci');
 const perms=await db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='los_app_ci'");
 if(perms.rows[0]?.rolsuper||perms.rows[0]?.rolbypassrls)throw Error('CI application role must never bypass RLS');
 console.log('Restricted PostgreSQL CI app role provisioned');
}finally{await db.end()}
