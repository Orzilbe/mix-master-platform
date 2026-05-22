import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

async function checkAdmin(userId: string | null): Promise<{ ok: boolean; reason: string }> {
  console.log(`[admin/activate] userId=${userId ?? "(not logged in)"} ADMIN_USER_IDS=${process.env.ADMIN_USER_IDS ?? "(not set)"}`);

  if (!userId) {
    return {
      ok: false,
      reason: "Not logged in. Open /join or /profile, log in, then return to /display?admin=true",
    };
  }

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
    const ok = inExplicitList || isFirstPlayer;

    console.log(`[admin/activate] explicit=${inExplicitList} firstPlayer=${isFirstPlayer} (first=${data?.clerk_id}) → ${ok ? "PASS" : "FAIL"}`);

    if (ok) return { ok: true, reason: inExplicitList ? "explicit list" : "first registered player" };
    return {
      ok: false,
      reason: `Not authorized. Add ADMIN_USER_IDS=${userId} to Vercel env vars. First registered player is ${data?.clerk_id ?? "unknown"}.`,
    };
  } catch (err) {
    console.error("[admin/activate] DB error:", err);
    return { ok: false, reason: "DB error checking admin status" };
  }
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  const { ok, reason } = await checkAdmin(userId);

  if (!ok) {
    console.log(`[admin/activate] Forbidden — ${reason}`);
    return NextResponse.json({
      error:  "Forbidden",
      userId: userId ?? "(not logged in)",
      reason,
      hint:   userId
        ? `To grant access: add ADMIN_USER_IDS=${userId} to your Vercel environment variables.`
        : "Open the Mix Master platform (/join or /profile), log in, then come back to /display?admin=true.",
    }, { status: 403 });
  }

  const { active } = await req.json();
  const admin = supabaseAdmin();
  await admin
    .from("locations")
    .update({ is_active: Boolean(active), updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  return NextResponse.json({ success: true, is_active: Boolean(active) });
}
