import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES, type GameSlug } from "@/lib/games";

function selectDailyGame(dayOfWeek: number): GameSlug {
  if (dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4) return "paperio";
  if (dayOfWeek === 2 || dayOfWeek === 5) return "last-one-standing";
  // Wed (3) / Sat (6): random
  const slugs = Object.keys(GAMES) as GameSlug[];
  return slugs[Math.floor(Math.random() * slugs.length)];
}

export async function GET() {
  const admin = supabaseAdmin();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await admin
    .from("daily_game")
    .select("game_slug, is_override")
    .eq("game_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let slug: GameSlug;
  let isOverride = false;

  if (existing) {
    slug      = (existing.game_slug as GameSlug) in GAMES
                  ? (existing.game_slug as GameSlug)
                  : "paperio";
    isOverride = existing.is_override ?? false;
  } else {
    slug = selectDailyGame(new Date().getUTCDay());
    await admin.from("daily_game").insert({ game_slug: slug, game_date: today, is_override: false });
  }

  const game       = GAMES[slug];
  const gameServer = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "";

  return NextResponse.json(
    {
      gameSlug:      game.slug,
      gameName:      game.name,
      gameColor:     game.color,
      gameUrl:       `${gameServer}${game.displayPath}`,
      controllerUrl: `${gameServer}${game.controllerPath}`,
      isOverride,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
