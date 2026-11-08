/** All Phase 6 account/record requests are guarded by exact same-origin and CSRF intent. */
import type {AuthContext} from './auth.ts';
import {authRoute} from './auth.ts';
import {recordsRoute} from './records.ts';
export async function phase6Route(req:Request,ctx:AuthContext):Promise<Response>{
  const path=new URL(req.url).pathname;
  if(req.method==='OPTIONS'){
    if(req.headers.get('origin')!==ctx.origin)return Response.json({error:'invalid_origin'},{status:403});
    return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ctx.origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Learning-Intent','Vary':'Origin','Cache-Control':'no-store'}});
  }
  const response=path.startsWith('/v1/auth/')?await authRoute(req,ctx):path.startsWith('/v1/records')?await recordsRoute(req,ctx):Response.json({error:'not_found'},{status:404});
  // Explicit allowed origin only; cookies are HttpOnly, never readable by JavaScript.
  response.headers.set('Access-Control-Allow-Origin',ctx.origin);
  response.headers.set('Access-Control-Allow-Credentials','true');
  response.headers.set('Vary','Origin');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('Cross-Origin-Resource-Policy','same-origin');
  response.headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  response.headers.set('Cache-Control','no-store');
  return response;
}
