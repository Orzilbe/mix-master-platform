-- ══════════════════════════════════════════════════════════════════════════════
-- Mix Master Platform — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ── cleanup: unused tables ───────────────────────────────────────────────────
DROP TABLE IF EXISTS players_tokens;

-- ── players ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT        UNIQUE NOT NULL,
  username    TEXT        NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── game_sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_slug   TEXT        NOT NULL DEFAULT 'mix-master-arena',
  score       INTEGER     NOT NULL DEFAULT 0,
  played_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_played ON game_sessions(played_at DESC);

-- ── weekly leaderboard (view) ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT
  p.id                                                      AS player_id,
  p.clerk_id,
  p.username,
  p.avatar_url,
  DATE_TRUNC('week', gs.played_at)                          AS week_start,
  EXTRACT(WEEK  FROM gs.played_at)::INT                     AS week_number,
  EXTRACT(ISOYEAR FROM gs.played_at)::INT                   AS week_year,
  SUM(gs.score)::INT                                        AS total_score,
  COUNT(gs.id)::INT                                         AS games_played
FROM players p
JOIN game_sessions gs ON gs.player_id = p.id
GROUP BY
  p.id, p.clerk_id, p.username, p.avatar_url,
  DATE_TRUNC('week', gs.played_at),
  EXTRACT(WEEK FROM gs.played_at),
  EXTRACT(ISOYEAR FROM gs.played_at)
ORDER BY total_score DESC;

-- ── weekly_champions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_champions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID        NOT NULL REFERENCES players(id),
  week_number  INT         NOT NULL,
  week_year    INT         NOT NULL,
  total_score  INT         NOT NULL,
  crowned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_number, week_year)
);

-- ── locations ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT             NOT NULL DEFAULT 'Main Venue',
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  radius_m    INT              NOT NULL DEFAULT 100,
  is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ── Function: archive last week's champion ────────────────────────────────────
-- Call manually or via pg_cron every Monday at 00:05 UTC:
--   SELECT cron.schedule('archive-champion', '5 0 * * 1', 'SELECT archive_weekly_champion()');
CREATE OR REPLACE FUNCTION archive_weekly_champion()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  _week INT := EXTRACT(WEEK    FROM NOW() - INTERVAL '7 days')::INT;
  _year INT := EXTRACT(ISOYEAR FROM NOW() - INTERVAL '7 days')::INT;
  _rec  RECORD;
BEGIN
  SELECT player_id, total_score INTO _rec
  FROM weekly_leaderboard
  WHERE week_number = _week AND week_year = _year
  ORDER BY total_score DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO weekly_champions (player_id, week_number, week_year, total_score)
    VALUES (_rec.player_id, _week, _year, _rec.total_score)
    ON CONFLICT (week_number, week_year) DO NOTHING;
  END IF;
END;
$$;

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE players          ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_champions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations        ENABLE ROW LEVEL SECURITY;

-- Public read on all tables
CREATE POLICY "players: public read"    ON players          FOR SELECT USING (true);
CREATE POLICY "sessions: public read"   ON game_sessions    FOR SELECT USING (true);
CREATE POLICY "champions: public read"  ON weekly_champions FOR SELECT USING (true);
CREATE POLICY "locations: public read"  ON locations        FOR SELECT USING (true);

-- Views don't inherit RLS policies — grant SELECT explicitly
-- (Code already uses supabase-admin to bypass this, but belt-and-suspenders)
GRANT SELECT ON weekly_leaderboard TO anon, authenticated;

-- Writes go through the service-role key (server-side API routes only)
CREATE POLICY "players: service insert"  ON players       FOR INSERT WITH CHECK (true);
CREATE POLICY "players: service update"  ON players       FOR UPDATE USING (true);
CREATE POLICY "sessions: service insert" ON game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "locations: service write" ON locations     FOR ALL    USING (true);
