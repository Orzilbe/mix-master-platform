import { supabase, supabaseAdmin } from "./supabase";
import type { Player, GameSession, WeeklyLeaderboardRow, WeeklyChampion, Location, PlayerToken } from "./types";

// ── Players ───────────────────────────────────────────────────────────────────

export async function getOrCreatePlayer(
  clerkId: string,
  username: string,
  avatarUrl?: string | null,
): Promise<Player> {
  const admin = supabaseAdmin();

  // Try fetch first (no upsert to avoid overwriting username on every login)
  const { data: existing } = await admin
    .from("players")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  if (existing) return existing as Player;

  const { data, error } = await admin
    .from("players")
    .insert({ clerk_id: clerkId, username, avatar_url: avatarUrl ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Player;
}

export async function getPlayer(clerkId: string): Promise<Player | null> {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();
  return (data as Player) ?? null;
}

// ── Game Sessions ─────────────────────────────────────────────────────────────

export async function saveGameSession(
  playerId: string,
  score: number,
  gameSlug = "mix-master-arena",
): Promise<GameSession> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("game_sessions")
    .insert({ player_id: playerId, score, game_slug: gameSlug })
    .select()
    .single();
  if (error) throw error;
  return data as GameSession;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function getWeeklyLeaderboard(
  weekOffset = 0, // 0 = current week, -1 = last week
): Promise<WeeklyLeaderboardRow[]> {
  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);
  const isoWeek = getISOWeek(now);
  const isoYear = getISOYear(now);

  const { data, error } = await supabase
    .from("weekly_leaderboard")
    .select("*")
    .eq("week_number", isoWeek)
    .eq("week_year", isoYear)
    .order("total_score", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as WeeklyLeaderboardRow[];
}

// ── Champions ─────────────────────────────────────────────────────────────────

export async function getLatestChampion(): Promise<WeeklyChampion | null> {
  const { data } = await supabase
    .from("weekly_champions")
    .select("*, players(username, avatar_url, clerk_id)")
    .order("week_year",   { ascending: false })
    .order("week_number", { ascending: false })
    .limit(1)
    .single();
  return (data as WeeklyChampion) ?? null;
}

// ── Player tokens (game join) ─────────────────────────────────────────────────

const SLOT_COLORS = ["#FF2D78", "#00E5FF", "#76FF03", "#FF6D00"];

export async function getActiveTokenColors(): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("player_tokens")
    .select("color")
    .eq("used", false)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []).map((r: { color: string }) => r.color);
}

export async function createJoinToken(playerId: string, color: string): Promise<PlayerToken> {
  const admin = supabaseAdmin();
  // Invalidate any existing active tokens for this player
  await admin
    .from("player_tokens")
    .update({ used: true })
    .eq("player_id", playerId)
    .eq("used", false);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  const { data, error } = await admin
    .from("player_tokens")
    .insert({ player_id: playerId, color, expires_at: expiresAt.toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as PlayerToken;
}

export async function validateToken(token: string): Promise<PlayerToken | null> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("player_tokens")
    .select("*, players(username, avatar_url, clerk_id)")
    .eq("token", token)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();
  return (data as PlayerToken) ?? null;
}

export async function invalidateToken(token: string): Promise<void> {
  const admin = supabaseAdmin();
  await admin.from("player_tokens").update({ used: true }).eq("token", token);
}

export { SLOT_COLORS };

// ── Player weekly score ───────────────────────────────────────────────────────

export async function getPlayerWeeklyScore(playerId: string): Promise<number> {
  const now = new Date();
  const { data } = await supabase
    .from("weekly_leaderboard")
    .select("total_score")
    .eq("player_id", playerId)
    .eq("week_number", getISOWeek(now))
    .eq("week_year", getISOYear(now))
    .single();
  return (data as { total_score: number } | null)?.total_score ?? 0;
}

// ── Player game history ───────────────────────────────────────────────────────

export async function getPlayerGameHistory(
  playerId: string,
  limit = 10,
): Promise<GameSession[]> {
  const { data } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("player_id", playerId)
    .order("played_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as GameSession[];
}

// ── All-time leaderboard ──────────────────────────────────────────────────────

export async function getAllTimeLeaderboard(limit = 20): Promise<
  { player_id: string; username: string; total_score: number; games_played: number }[]
> {
  // Aggregate via JS — fine for moderate dataset sizes
  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("player_id, score, players(username)");

  if (!sessions) return [];

  type Row = { player_id: string; score: number; players: unknown };
  const agg: Record<string, { username: string; total: number; count: number }> = {};

  for (const s of sessions as Row[]) {
    const pl = s.players as { username?: string } | null;
    if (!agg[s.player_id]) {
      agg[s.player_id] = { username: pl?.username ?? "—", total: 0, count: 0 };
    }
    agg[s.player_id].total += s.score as number;
    agg[s.player_id].count += 1;
  }

  return Object.entries(agg)
    .map(([player_id, e]) => ({
      player_id,
      username:     e.username,
      total_score:  e.total,
      games_played: e.count,
    }))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, limit);
}

// ── Locations ─────────────────────────────────────────────────────────────────

export async function getActiveLocation(): Promise<Location | null> {
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  return (data as Location) ?? null;
}

export async function upsertLocation(
  lat: number,
  lon: number,
  radius_m: number,
  name = "Main Venue",
): Promise<Location> {
  const admin = supabaseAdmin();
  // Deactivate all, then insert new active one
  await admin.from("locations").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  const { data, error } = await admin
    .from("locations")
    .insert({ lat, lon, radius_m, name, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data as Location;
}

// ── ISO week helpers (no external dependency) ─────────────────────────────────

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOYear(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return date.getUTCFullYear();
}
