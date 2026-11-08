#!/usr/bin/env bash
# Encrypted logical backup. Never store an unencrypted learning journal dump.
set -euo pipefail
umask 077
: "${DATABASE_URL:?Set a dedicated PostgreSQL connection}"
: "${AGE_RECIPIENT:?Set an age public recipient key}"
: "${BACKUP_DIR:?Set a protected destination directory}"
for command in pg_dump age; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 2; }; done
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
name="learning-os-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
target="$BACKUP_DIR/$name"
tmp="$(mktemp "$BACKUP_DIR/.backup.XXXXXXXX")"
trap 'rm -f "$tmp"' EXIT
if [[ -e "$target" ]]; then echo "Backup already exists: $target" >&2; exit 2; fi
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl | age -r "$AGE_RECIPIENT" > "$tmp"
test -s "$tmp"
mv -n "$tmp" "$target"
echo "Encrypted backup created: $target"
echo "Store it off-host and perform a periodic isolated restore. Retention and off-host copying are operator responsibilities."
