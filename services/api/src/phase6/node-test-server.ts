/** Node HTTP test-only adapter for the same Fetch handlers used by Bun.
 * This is deliberately not a public production server.
 */
import {createServer} from 'node:http';
import {phase6Route} from './routes.ts';
import {pool} from './db.ts';
const port=Number(process.env.API_PORT||3005);
const origin=process.env.WEB_ORIGIN||'http://127.0.0.1:5173';
const server=createServer(async(req,res)=>{
  const chunks:Buffer[]=[];
  for await(const part of req)chunks.push(Buffer.from(part));
  const body=Buffer.concat(chunks);
  const url=`http://127.0.0.1:${port}${req.url||'/'}`;
  try{
    const response=await phase6Route(new Request(url,{method:req.method,headers:req.headers as HeadersInit,...(req.method==='GET'||req.method==='HEAD'?{}:{body})}),{db:pool,origin,secure:false,ip:req.socket.remoteAddress||'local'});
    res.statusCode=response.status;
    // Fetch Headers may contain multiple Set-Cookie fields. Preserve them separately
    // through the test-only Node adapter, matching Bun's browser behavior.
    response.headers.forEach((v,k)=>{if(k.toLowerCase()!=='set-cookie')res.setHeader(k,v)});
    const cookies=response.headers.getSetCookie();
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){console.error('Phase 6 test gateway failed:',e);res.statusCode=503;res.end(JSON.stringify({error:'test_gateway_unavailable'}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Phase 6 Node test gateway on ${port}`));
const stop=async()=>{server.close();await pool.end();};
process.once('SIGTERM',()=>{void stop()});process.once('SIGINT',()=>{void stop()});
