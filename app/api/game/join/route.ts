import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer, getActiveTokenColors, createJoinToken, SLOT_COLORS } from "@/lib/db";

export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayer(userId);
  if (!player) {
    return NextResponse.json({ error: "Player not found — visit /hub first" }, { status: 404 });
  }

  // Assign first available color (based on currently active tokens)
  const takenColors = new Set(await getActiveTokenColors());
  const color = SLOT_COLORS.find(c => !takenColors.has(c)) ?? SLOT_COLORS[0];

  const tokenRow = await createJoinToken(player.id, color);

  const gameBase = process.env.GAME_SERVER_URL ?? "https://mix-master-8gh1.onrender.com";
  const controllerUrl = `${gameBase}/controller?token=${tokenRow.token}`;

  return NextResponse.json({
    token:        tokenRow.token,
    username:     player.username,
    avatar_url:   player.avatar_url,
    color,
    controllerUrl,
  });
}
