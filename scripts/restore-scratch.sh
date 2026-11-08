#!/usr/bin/env bash
# Only restore to an isolated disposable database, never the live database.
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set the scratch restore database URL}"
: "${AGE_IDENTITY:?Set path to a private age identity not stored in the repository}"
: "${BACKUP_FILE:?Set encrypted .age backup path}"
[[ "${RESTORE_CONFIRM:-}" == "test-only" ]] || { echo "Set RESTORE_CONFIRM=test-only to acknowledge destructive restore" >&2; exit 2; }
for command in psql pg_restore age; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 2; }; done
database="$(psql "$RESTORE_DATABASE_URL" -Atqc 'SELECT current_database()')"
[[ "$database" =~ (_restore|_test)$ ]] || { echo "Refusing to restore into $database: scratch DB must end _restore or _test" >&2; exit 2; }
[[ -s "$BACKUP_FILE" ]] || { echo "Backup not found or empty" >&2; exit 2; }
age --decrypt -i "$AGE_IDENTITY" "$BACKUP_FILE" |
  pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 'los_users=' || count(*) FROM los_users"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 'los_records=' || count(*) FROM los_records"
echo "Isolated restore complete. Check identity/security/RLS and retained rows manually."
