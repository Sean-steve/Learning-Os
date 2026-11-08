#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
: "${WEB_ORIGIN:?WEB_ORIGIN required}"
: "${API_PORT:=3005}"
: "${API_HOST:=127.0.0.1}"
command -v bun >/dev/null || { echo "Real Bun is required for this test" >&2; exit 2; }
command -v curl >/dev/null
bun services/api/src/server.ts >/tmp/learning-os-bun-smoke.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$API_PORT/health" -o /tmp/learning-os-bun-health.json; then break; fi
  sleep 1
done
node -e "const s=require('/tmp/learning-os-bun-health.json');if(s.ok!==true||s.database!=='connected')process.exit(1)"
email="phase7-bun-$(date +%s)-$RANDOM@example.test"
cookie="$(mktemp)"
trap 'kill "$pid" 2>/dev/null || true; rm -f "$cookie"' EXIT
curl --fail-with-body -fsS -c "$cookie" -X POST "http://127.0.0.1:$API_PORT/v1/auth/register" \
 -H "Origin: $WEB_ORIGIN" -H 'X-Learning-Intent: manual-sync' -H 'Content-Type: application/json' \
 -d "{\"email\":\"$email\",\"password\":\"safe and unique bun smoke password 2026\"}" >/tmp/los-bun-register.json
curl --fail-with-body -fsS -b "$cookie" "http://127.0.0.1:$API_PORT/v1/auth/sessions" >/tmp/los-bun-sessions.json
node -e "const j=require('/tmp/los-bun-sessions.json');if(j.sessions.length!==1||!j.sessions[0].current)process.exit(1)"
curl --fail-with-body -fsS -b "$cookie" -X PUT "http://127.0.0.1:$API_PORT/v1/records" \
 -H "Origin: $WEB_ORIGIN" -H 'X-Learning-Intent: manual-sync' -H 'Content-Type: application/json' \
 -d '{"key":"los.journal","data":[{"title":"Bun durable smoke"}],"revision":0}' >/tmp/los-bun-write.json
curl --fail-with-body -fsS -b "$cookie" "http://127.0.0.1:$API_PORT/v1/records" >/tmp/los-bun-read.json
node -e "const j=require('/tmp/los-bun-read.json');if(!j.records.some(r=>r.key==='los.journal'&&r.data[0].title==='Bun durable smoke'))process.exit(1)"
curl --fail-with-body -fsS -b "$cookie" -X POST "http://127.0.0.1:$API_PORT/v1/auth/logout" \
 -H "Origin: $WEB_ORIGIN" -H 'X-Learning-Intent: manual-sync' -d '{}' >/dev/null
echo 'Real Bun + PostgreSQL authentication, sessions, records and logout smoke PASS'
