/** Phase 1 API foundation. No persistent user data or AI calls yet. */
const port = Number(process.env.API_PORT ?? 3005);
const origin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

Bun.serve({
  port,
  fetch(req) {
    const path = new URL(req.url).pathname;
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
    if (req.method !== 'GET') return Response.json({ error: 'not_implemented', message: 'Phase 1 is frontend-only.' }, { status: 501, headers });
    if (path === '/health') return Response.json({ ok: true, service: 'learning-os-api', phase: 1, persistence: false }, { headers });
    if (path === '/v1/meta') return Response.json({ name: 'Learning OS', version: '0.1.0', apiStatus: 'foundation-only', timezone: 'Africa/Nairobi' }, { headers });
    return Response.json({ error: 'not_found' }, { status: 404, headers });
  }
});
console.log(`Learning OS TypeScript API foundation listening on http://localhost:${port}`);
