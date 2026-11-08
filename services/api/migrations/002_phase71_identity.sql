-- Phase 7.1: MFA and database-backed authentication throttling.
-- Run as migration owner. Never grant these tables to anonymous clients.
CREATE TABLE IF NOT EXISTS los_mfa (
  user_id uuid PRIMARY KEY REFERENCES los_users(id) ON DELETE CASCADE,
  secret_enc text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  last_step bigint NOT NULL DEFAULT -1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS los_mfa_recovery (
  user_id uuid NOT NULL REFERENCES los_users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  PRIMARY KEY(user_id, code_hash)
);
CREATE TABLE IF NOT EXISTS los_mfa_challenges (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES los_users(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS los_mfa_challenges_expiry ON los_mfa_challenges(expires_at);
CREATE TABLE IF NOT EXISTS los_auth_limits (
  bucket_hash char(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS los_auth_limits_reset ON los_auth_limits(reset_at);
