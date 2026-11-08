#!/usr/bin/env bash
set -euo pipefail
# Requires Ubuntu PostgreSQL already running. Creates a dedicated local-only account/db.
ROLE=${LOS_DB_USER:-learning_os}
DB=${LOS_DB_NAME:-learning_os}
PASS=${LOS_DB_PASS:-learning_os_local}
if ! [[ $ROLE =~ ^[a-z_][a-z0-9_]*$ && $DB =~ ^[a-z_][a-z0-9_]*$ ]]; then echo 'Invalid role/db name' >&2; exit 1; fi
# Adjust these credentials for non-development use.
sudo -u postgres psql -v ON_ERROR_STOP=1 -v role="$ROLE" -v pass="$PASS" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'role')\gexec
SQL
sudo -u postgres psql -v ON_ERROR_STOP=1 -v db="$DB" -v role="$ROLE" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'db')\gexec
SQL
printf '\nSet DATABASE_URL=postgres://%s:YOUR_PASSWORD@127.0.0.1:5432/%s then run npm run db:migrate\n' "$ROLE" "$DB"
