import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer, getWeeklyLeaderboard } from "@/lib/db";

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

  return NextResponse.json({ player, weeklyRank, weeklyScore });
}
