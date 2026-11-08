#!/usr/bin/env bash
set -euo pipefail
API_PORT=3005 API_HOST=127.0.0.1 bun services/api/src/server.ts >/tmp/los-api-test.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
for i in $(seq 1 20); do
  curl -fsS http://127.0.0.1:3005/health -o /tmp/los-health.json && break
  sleep 1
done
node -e "const f=require('fs'); const x=JSON.parse(f.readFileSync('/tmp/los-health.json')); if(!x.ok || x.phase!==2 || x.aiConfigured!==false) process.exit(1)"
status=$(curl -s -o /tmp/los-no-key.json -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' \
  -d '{"plan":{}}' http://127.0.0.1:3005/v1/plans/ai-generate)
test "$status" = 503
echo 'API local-only health and missing-key guard PASS'
