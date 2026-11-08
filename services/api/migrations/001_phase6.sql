-- Learning OS Phase 6. Run using a migration owner account, not a public client role.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS los_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(email) <= 254)
);
CREATE TABLE IF NOT EXISTS los_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES los_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS los_sessions_user_idx ON los_sessions(user_id);
CREATE INDEX IF NOT EXISTS los_sessions_expire_idx ON los_sessions(expires_at);
CREATE TABLE IF NOT EXISTS los_records (
  user_id uuid NOT NULL REFERENCES los_users(id) ON DELETE CASCADE,
  record_key varchar(110) NOT NULL,
  data jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, record_key),
  CHECK (jsonb_typeof(data) IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS los_records_updated_idx ON los_records(user_id,updated_at DESC);
-- All app record access must SET LOCAL app.user_id inside the transaction.
ALTER TABLE los_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE los_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS los_records_isolation ON los_records;
CREATE POLICY los_records_isolation ON los_records
  USING (user_id = NULLIF(current_setting('app.user_id', true),'')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true),'')::uuid);
