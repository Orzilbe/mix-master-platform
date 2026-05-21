import { NextRequest, NextResponse } from "next/server";
import { getPlayer, saveGameSession } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, territory_pct } = body as {
    userId?: string;
    territory_pct?: number;
  };

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (territory_pct === undefined) return NextResponse.json({ error: "Missing territory_pct" }, { status: 400 });

  const player = await getPlayer(userId);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const score = Math.round(Math.max(0, Math.min(100, territory_pct)) * 10);
  await saveGameSession(player.id, score);
  return NextResponse.json({ success: true });
}
