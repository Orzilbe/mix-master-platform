import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = supabaseAdmin();

    // Always return the most recently inserted row — the override route
    // deletes the previous entry before inserting, so latest == current.
    const { data, error } = await admin
      .from("daily_game")
      .select("game_slug, game_date")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log(`[daily-game] latest row:`, JSON.stringify(data), error ? `error=${error.message}` : "ok");

    const slug = (data?.[0]?.game_slug as string) ?? "paperio";
    const game = GAMES[slug] ?? GAMES["paperio"];
    console.log(`[daily-game] GAMES[${slug}]=`, JSON.stringify(game));

    const payload = {
      gameSlug:       game.slug,
      gameName:       game.name,
      displayPath:    game.displayPath,
      controllerPath: game.controllerPath,
      color:          game.color,
    };
    console.log(`[daily-game] returning payload:`, JSON.stringify(payload));
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma":        "no-cache",
      },
    });
  } catch (err) {
    console.log("[daily-game] catch — defaulting to paperio:", err);
    const game = GAMES["paperio"];
    const payload = {
      gameSlug:       game.slug,
      gameName:       game.name,
      displayPath:    game.displayPath,
      controllerPath: game.controllerPath,
      color:          game.color,
    };
    console.log(`[daily-game] catch payload:`, JSON.stringify(payload));
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma":        "no-cache",
      },
    });
  }
}
