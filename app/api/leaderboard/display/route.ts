import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getWeeklyLeaderboard, getLatestChampion } from "@/lib/db";
import type { AvatarConfig } from "@/lib/types";

export async function GET() {
  const [rows, champion] = await Promise.all([
    getWeeklyLeaderboard(0),
    getLatestChampion(),
  ]);

  const top10 = rows.slice(0, 10);

  // Enrich with avatar_config (not present in the weekly_leaderboard view)
  let avatarMap = new Map<string, AvatarConfig | null>();
  const playerIds = top10.map(r => r.player_id);
  if (playerIds.length > 0) {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("players")
      .select("id, avatar_config")
      .in("id", playerIds);
    avatarMap = new Map(
      (data ?? []).map((p: { id: string; avatar_config: AvatarConfig | null }) => [
        p.id,
        p.avatar_config,
      ]),
    );
  }

  const board = top10.map(r => ({
    ...r,
    avatar_config: avatarMap.get(r.player_id) ?? null,
  }));

  return NextResponse.json({ board, champion });
}
