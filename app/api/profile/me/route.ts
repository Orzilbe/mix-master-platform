import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer, getWeeklyLeaderboard } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [player, board] = await Promise.all([
    getPlayer(userId),
    getWeeklyLeaderboard(0),
  ]);

  const myIdx      = board.findIndex(r => r.clerk_id === userId);
  const weeklyRank  = myIdx >= 0 ? myIdx + 1 : null;
  const weeklyScore = myIdx >= 0 ? board[myIdx].total_score : 0;

  let gamesPlayed = 0;
  let bestScore   = 0;
  if (player) {
    const { data: sessions } = await supabase
      .from("game_sessions")
      .select("score")
      .eq("player_id", player.id)
      .order("score", { ascending: false });
    if (sessions) {
      gamesPlayed = sessions.length;
      bestScore   = sessions[0]?.score ?? 0;
    }
  }

  console.log('[/api/profile/me] player:', JSON.stringify(player));
  return NextResponse.json({ player, weeklyRank, weeklyScore, gamesPlayed, bestScore });
}
