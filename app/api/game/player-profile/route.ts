import { NextRequest, NextResponse } from "next/server";
import { getPlayer } from "@/lib/db";

function authorized(req: NextRequest): boolean {
  return req.headers.get("x-api-secret") === process.env.GAME_API_SECRET;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const player = await getPlayer(userId);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      userId: player.clerk_id,
      username: player.username,
      avatarUrl: player.avatar_url ?? null,
      avatarConfig: player.avatar_config ?? null,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
