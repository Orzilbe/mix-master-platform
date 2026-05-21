import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlayer } from "@/lib/db";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayer(userId);
  return NextResponse.json({ player });
}
