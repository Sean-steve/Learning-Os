/** Optional, explicit, LOCAL-ONLY AI learning check-in.
 * The model sees numeric summaries, never calendar descriptions or notes.
 */
export async function aiAccountabilityRoute(req: Request, context: { origin: string; hostname: string; apiKey: string; model: string }): Promise<Response> {
  const headers = { 'Access-Control-Allow-Origin': context.origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
  const respond = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if(req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  if(!['127.0.0.1', 'localhost'].includes(context.hostname) || !/^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(context.origin)) return respond({ error: 'local_only' }, 403);
  if(req.headers.get('Origin') !== context.origin) return respond({ error: 'forbidden_origin' }, 403);
  if(!context.apiKey) return respond({ error: 'ai_not_configured' }, 503);
  if(Number(req.headers.get('Content-Length') || 0) > 2000) return respond({ error: 'input_too_large' }, 413);
  try {
    const raw = await req.text(); if(raw.length > 2000) return respond({ error: 'input_too_large' }, 413);
    const data = JSON.parse(raw) as Record<string, unknown>;
    const shape = ['due','done','missed','upcoming','sleepQuality','dailyLimit'];
    for(const key of shape) if(!Number.isInteger(data[key]) || (data[key] as number) < 0 || (data[key] as number) > 1000) return respond({ error: 'invalid_metrics' }, 400);
    if((data.sleepQuality as number) < 1 || (data.sleepQuality as number) > 10 || (data.dailyLimit as number) < 15 || (data.dailyLimit as number) > 180) return respond({error:'invalid_metrics'},400);
    if((data.missed as number) > (data.due as number) || (data.done as number) > ((data.due as number) + (data.upcoming as number))) return respond({error:'invalid_metrics'},400);
    const instructions = 'You are an evidence-based learning accountability coach. Given numeric study completion data and reported sleep quality, return 2–3 concise, empathetic, actionable sentences. Protect sleep and rest, prioritize audio-first small habits, never shame or pressure the learner, never claim paranormal powers are proven, and do not claim to know the learner personally. Do not suggest medical treatment. Plain text only.';
    const result = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: 'Bearer ' + context.apiKey, 'Content-Type':'application/json' },
      body: JSON.stringify({ model:context.model, input:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(data)}], max_output_tokens:240 }),
      signal: AbortSignal.timeout(20_000),
    });
    if(!result.ok) return respond({error:'ai_service_unavailable'},502);
    const parsed=await result.json() as { output_text?:string; output?:{content?:{type?:string;text?:string}[]}[] };
    const note=(parsed.output_text || parsed.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('') || '').trim().slice(0,900);
    if(!note) return respond({error:'invalid_ai_response'},502);
    return respond({guidance:note,origin:'live-ai',persistence:'none'});
  } catch { return respond({error:'ai_service_unavailable'},502); }
}
