import { NextRequest, NextResponse } from "next/server";
import { validateToken, saveGameSession, invalidateToken } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { token, territory_pct } = body as { token?: string; territory_pct?: number };

  if (!token || territory_pct === undefined) {
    return NextResponse.json({ error: "Missing token or territory_pct" }, { status: 400 });
  }

  const row = await validateToken(token);
  if (!row) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Store score as integer 0-1000 (pct × 10 preserves one decimal of precision)
  const score = Math.round(Math.max(0, Math.min(100, territory_pct)) * 10);
  await saveGameSession(row.player_id, score);
  await invalidateToken(token);

  return NextResponse.json({ success: true });
}
