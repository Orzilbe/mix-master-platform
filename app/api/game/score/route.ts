import { NextRequest, NextResponse } from "next/server";
import { getPlayer, saveGameSession, validateToken, invalidateToken } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, token, territory_pct } = body as {
    userId?: string;
    token?: string;
    territory_pct?: number;
  };

  if (territory_pct === undefined) {
    return NextResponse.json({ error: "Missing territory_pct" }, { status: 400 });
  }

  const score = Math.round(Math.max(0, Math.min(100, territory_pct)) * 10);
  let playerId: string;

  if (userId) {
    // New flow: identified by Clerk userId
    const player = await getPlayer(userId);
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
    playerId = player.id;
  } else if (token) {
    // Legacy token flow
    const row = await validateToken(token);
    if (!row) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    playerId = row.player_id;
    await invalidateToken(token);
  } else {
    return NextResponse.json({ error: "Missing userId or token" }, { status: 400 });
  }

  await saveGameSession(playerId, score);
  return NextResponse.json({ success: true });
}
