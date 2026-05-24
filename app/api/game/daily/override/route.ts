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
  if (!(await checkAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gameSlug } = await req.json();
  if (!GAMES[gameSlug]) {
    return NextResponse.json({ error: "Unknown game slug" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const today = new Date().toISOString().split("T")[0];

  await admin.from("daily_game").delete().eq("game_date", today);

  const { data, error } = await admin
    .from("daily_game")
    .insert({ game_slug: gameSlug, game_date: today, is_override: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, game: data });
}
