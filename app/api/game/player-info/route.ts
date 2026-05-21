import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const row = await validateToken(token);
  if (!row) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const player = row.players as { username: string; avatar_url: string | null } | undefined;

  return NextResponse.json({
    username:  player?.username  ?? "Unknown",
    avatar_url: player?.avatar_url ?? null,
    color:     row.color,
  });
}
