import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES, type GameSlug } from "@/lib/games";

async function checkAdmin(userId: string | null): Promise<{ ok: boolean; reason: string }> {
  if (!userId) return { ok: false, reason: "Not logged in" };
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from("players")
      .select("clerk_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    const inExplicitList = (process.env.ADMIN_USER_IDS ?? "")
      .split(",").map(s => s.trim()).filter(Boolean)
      .includes(userId);
    const isFirstPlayer  = data?.clerk_id === userId;
    const ok = inExplicitList || isFirstPlayer;
    if (ok) return { ok: true, reason: inExplicitList ? "explicit list" : "first registered player" };
    return { ok: false, reason: "Not authorized" };
  } catch {
    return { ok: false, reason: "DB error" };
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const { ok, reason } = await checkAdmin(userId ?? null);
  if (!ok) return NextResponse.json({ error: reason }, { status: 403 });

  const { gameSlug } = await req.json();
  if (!(gameSlug in GAMES)) {
    return NextResponse.json({ error: "Invalid game slug" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await admin
    .from("daily_game")
    .select("id")
    .eq("game_date", today)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from("daily_game")
      .update({ game_slug: gameSlug as GameSlug, is_override: true })
      .eq("id", existing.id);
  } else {
    await admin
      .from("daily_game")
      .insert({ game_slug: gameSlug, game_date: today, is_override: true });
  }

  console.log(`[daily-game] override → ${gameSlug} by ${userId}`);
  return NextResponse.json({ ok: true, gameSlug });
}
