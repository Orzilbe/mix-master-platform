import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getPlayer, saveGameSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { score, gameSlug } = await req.json();
  if (typeof score !== "number" || score < 0) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const player = await getPlayer(userId);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const session = await saveGameSession(player.id, Math.round(score), gameSlug);
  return NextResponse.json({ ok: true, session });
}
