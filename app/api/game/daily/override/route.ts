import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { GAMES } from "@/lib/games";

async function checkAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
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
    return inExplicitList || data?.clerk_id === userId;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  console.log("[override] POST received userId=", userId);

  const isAdmin = await checkAdmin(userId);
  console.log("[override] checkAdmin=", isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { gameSlug } = body;
  console.log("[override] gameSlug received=", gameSlug, "known=", !!GAMES[gameSlug]);
  if (!GAMES[gameSlug]) {
    return NextResponse.json({ error: "Unknown game slug" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const today = new Date().toISOString().split("T")[0];
  console.log("[override] UTC date=", today);

  const { error: deleteError, count: deleteCount } = await admin
    .from("daily_game")
    .delete({ count: "exact" })
    .eq("game_date", today);
  console.log("[override] delete rows=", deleteCount, deleteError ? `err=${deleteError.message}` : "ok");

  const { data, error } = await admin
    .from("daily_game")
    .insert({ game_slug: gameSlug, game_date: today, is_override: true })
    .select()
    .single();
  console.log("[override] insert result=", JSON.stringify(data), error ? `err=${error.message}` : "ok");

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { "Cache-Control": "no-store" } });

  // Tell the game server to clear the old game's lobby (fire-and-forget)
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (gameServerUrl) {
    fetch(`${gameServerUrl}/api/switch-game`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GAME_API_SECRET ? { "x-api-secret": process.env.GAME_API_SECRET } : {}),
      },
      body: JSON.stringify({ to: gameSlug }),
    }).catch(e => console.log("[override] switch-game call failed:", e.message));
  }

  return NextResponse.json({ success: true, game: data }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma":        "no-cache",
    },
  });
}
