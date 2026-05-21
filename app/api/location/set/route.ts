import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { upsertLocation } from "@/lib/db";

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

  const { lat, lng, name, radius_meters } = await req.json();
  const location = await upsertLocation(
    Number(lat),
    Number(lng),
    Number(radius_meters) || 200,
    name ?? "Main Venue",
  );
  return NextResponse.json({ success: true, location });
}
