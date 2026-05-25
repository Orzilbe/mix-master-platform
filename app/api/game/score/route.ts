import { NextRequest, NextResponse } from "next/server";
import { getPlayer, saveGameSession } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function POST(req: NextRequest) {
  console.log("[score] POST /api/game/score called");

  if (!authorized(req)) {
    console.log("[score] Forbidden — wrong or missing x-api-secret");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, territory_pct } = body as {
    userId?: string;
    territory_pct?: number;
  };
  console.log(`[score] userId=${userId}  territory_pct=${territory_pct}`);

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (territory_pct === undefined) return NextResponse.json({ error: "Missing territory_pct" }, { status: 400 });

  const player = await getPlayer(userId);
  if (!player) {
    console.log(`[score] Player not found for clerkId=${userId} — was setup-profile completed?`);
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  console.log(`[score] Found player id=${player.id} username=${player.username}`);

  const score = Math.round(Math.max(0, Math.min(100, territory_pct)) * 10);
  console.log(`[score] Saving session: score=${score} (${territory_pct.toFixed(1)}%)`);

  try {
    await saveGameSession(player.id, score);
    console.log(`[score] Saved successfully for player=${player.id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[score] saveGameSession error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
