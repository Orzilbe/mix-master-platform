import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

function isAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return ids.length === 0 || ids.includes(userId);
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { active } = await req.json();
  const admin = supabaseAdmin();
  await admin
    .from("locations")
    .update({ is_active: Boolean(active), updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  return NextResponse.json({ success: true, is_active: Boolean(active) });
}
