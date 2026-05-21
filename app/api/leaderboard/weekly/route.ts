import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWeeklyLeaderboard } from "@/lib/db";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getWeeklyLeaderboard(0);

  const board = rows.slice(0, 5).map((r, i) => ({
    rank:        i + 1,
    clerk_id:    r.clerk_id,
    username:    r.username,
    total_score: r.total_score,
  }));

  const myIdx   = rows.findIndex(r => r.clerk_id === userId);
  const myRank  = myIdx >= 0 ? myIdx + 1 : null;
  const myScore = myIdx >= 0 ? rows[myIdx].total_score : 0;

  return NextResponse.json({ board, myRank, myScore });
}
