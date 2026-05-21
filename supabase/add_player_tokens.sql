-- ── player_tokens ─────────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor (separate from schema.sql)
-- Stores short-lived join tokens that link a Clerk user to a game controller slot

CREATE TABLE IF NOT EXISTS player_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  player_id  UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  color      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_token   ON player_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_player  ON player_tokens(player_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON player_tokens(expires_at DESC);

ALTER TABLE player_tokens ENABLE ROW LEVEL SECURITY;

-- All access goes through service role (server-side only — no anon/user access)
CREATE POLICY "tokens: service role only" ON player_tokens USING (false);
