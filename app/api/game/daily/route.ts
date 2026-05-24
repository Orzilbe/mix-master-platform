import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const today = new Date().toISOString().split("T")[0];
    console.log(`[daily-game] server UTC date=${today}`);

    const { data, error } = await admin
      .from("daily_game")
      .select("game_slug, game_date")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log(`[daily-game] raw query result:`, JSON.stringify(data), error ? `error=${error.message}` : "ok");

    const row  = data?.[0];
    const slug = (row?.game_slug as string) ?? "paperio";
    const game = GAMES[slug] ?? GAMES["paperio"];

    console.log(`[daily-game] row.game_date=${row?.game_date} slug=${slug} returning=${game.slug}`);

    const payload = {
      gameSlug:       game.slug,
      gameName:       game.name,
      displayPath:    game.displayPath,
      controllerPath: game.controllerPath,
      color:          game.color,
    };
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
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma":        "no-cache",
      },
    });
  }
}
