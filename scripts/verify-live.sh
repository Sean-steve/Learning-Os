#!/usr/bin/env bash
set -euo pipefail
: "${1:?Usage: bash scripts/verify-live.sh https://your-domain}"
url="${1%/}"
[[ "$url" =~ ^https://[a-zA-Z0-9.-]+$ ]] || { echo "A real HTTPS hostname is required" >&2; exit 2; }
[[ "$url" != *example.com* ]] || { echo "Replace example hostname before verification" >&2; exit 2; }
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
curl --fail --silent --show-error --location --max-time 15 --dump-header "$tmp" "$url/" >/dev/null
grep -iq '^strict-transport-security:' "$tmp" || { echo "Missing HSTS on frontend" >&2; exit 1; }
grep -iq '^content-security-policy:' "$tmp" || { echo "Missing Content-Security-Policy" >&2; exit 1; }
status="$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' "$url/api/v1/auth/me")"
[[ "$status" == "200" ]] || { echo "Auth health route returned $status (expected anonymous 200)" >&2; exit 1; }
echo "HTTPS/TLS/header/unauthenticated API smoke passed for $url."
echo "This does not certify MFA, backups, monitoring or a public release."
