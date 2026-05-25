import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES } from "@/lib/games";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const today = new Date().toISOString().split("T")[0];
    console.log(`[daily-game] server UTC date=${today}`);

    // Query today's row first — filtering by date prevents a stale row from
    // a previous day (with a later created_at) from winning over today's entry.
    const { data: todayData, error } = await admin
      .from("daily_game")
      .select("game_slug, game_date")
      .eq("game_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    console.log(`[daily-game] today rows:`, JSON.stringify(todayData), error ? `error=${error.message}` : "ok");

    let slug = "paperio";
    if (todayData && todayData.length > 0) {
      slug = (todayData[0].game_slug as string) ?? "paperio";
    } else {
      // No override for today — fall back to most recent row across all dates
      const { data: latestData } = await admin
        .from("daily_game")
        .select("game_slug, game_date")
        .order("created_at", { ascending: false })
        .limit(1);
      console.log(`[daily-game] no today row — latest fallback:`, JSON.stringify(latestData));
      slug = (latestData?.[0]?.game_slug as string) ?? "paperio";
    }

    const game = GAMES[slug] ?? GAMES["paperio"];
    console.log(`[daily-game] returning slug=${game.slug}`);

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
