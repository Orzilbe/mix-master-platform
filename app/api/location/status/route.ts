import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getActiveLocation } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// To add a second admin:
//   Vercel → Settings → Environment Variables → ADMIN_USER_IDS=user_abc123,user_xyz789
// Any user can find their own Clerk ID at: GET /api/debug-user
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
    const isFirstPlayer = data?.clerk_id === userId;

    return inExplicitList || isFirstPlayer;
  } catch {
    return false;
  }
}

export async function GET() {
  const { userId } = auth();
  const ok = await checkAdmin(userId);

  if (!ok) {
    return NextResponse.json(
      {
        error:  "Forbidden",
        userId: userId ?? "(not logged in)",
        hint:   userId
          ? `Add ADMIN_USER_IDS=${userId} to your Vercel environment variables.`
          : "Log into the platform (/join or /profile), then return to /display?admin=true.",
      },
      { status: 403 },
    );
  }

  try {
    const location = await getActiveLocation();
    return NextResponse.json({ location: location ?? null });
  } catch {
    return NextResponse.json({ location: null });
  }
}
