import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await admin
      .from("daily_game")
      .select("game_slug")
      .eq("game_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log(`[daily-game] date=${today} row=`, data, error ? `db-error=${error.message}` : "ok");

    const slug = (data?.game_slug as string) ?? "paperio";
    const game = GAMES[slug] ?? GAMES["paperio"];

    console.log(`[daily-game] returning slug=${slug}`);

    return NextResponse.json({
      gameSlug:       game.slug,
      gameName:       game.name,
      displayPath:    game.displayPath,
      controllerPath: game.controllerPath,
      color:          game.color,
    });
  } catch (err) {
    console.log("[daily-game] catch — defaulting to paperio:", err);
    const game = GAMES["paperio"];
    return NextResponse.json({
      gameSlug:       game.slug,
      gameName:       game.name,
      displayPath:    game.displayPath,
      controllerPath: game.controllerPath,
      color:          game.color,
    });
  }
}
