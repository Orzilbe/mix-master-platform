// Database row types matching supabase/schema.sql

// ── Avatar ────────────────────────────────────────────────────────────────────

export type AvatarShape     = 'spray-can' | 'robot' | 'alien' | 'cat';
export type AvatarAccessory = 'cap' | 'sunglasses' | 'headphones' | 'crown' | 'none';

export interface AvatarConfig {
  shape:     AvatarShape;
  color:     string;
  accessory: AvatarAccessory;
}

// ── Players ───────────────────────────────────────────────────────────────────

export interface Player {
  id:            string;
  clerk_id:      string;
  username:      string;
  avatar_url:    string | null;
  avatar_config: AvatarConfig | null;
  created_at:    string;
}

export interface GameSession {
  id: string;
  player_id: string;
  game_slug: string;
  score: number;
  played_at: string;
}

export interface WeeklyLeaderboardRow {
  player_id: string;
  clerk_id: string;
  username: string;
  avatar_url: string | null;
  avatar_config?: AvatarConfig | null;
  week_start: string;
  week_number: number;
  week_year: number;
  total_score: number;
  games_played: number;
}

export interface WeeklyChampion {
  id: string;
  player_id: string;
  week_number: number;
  week_year: number;
  total_score: number;
  crowned_at: string;
  // joined
  players?: Pick<Player, "username" | "avatar_url" | "clerk_id" | "avatar_config">;
}

export interface PlayerToken {
  id: string;
  token: string;
  player_id: string;
  color: string;
  expires_at: string;
  used: boolean;
  created_at: string;
  // joined (optional)
  players?: Pick<Player, "username" | "avatar_url" | "clerk_id">;
}

export interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius_m: number;
  is_active: boolean;
  updated_at: string;
}
