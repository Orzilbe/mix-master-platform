import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { updatePlayerProfile } from "@/lib/db";
import type { AvatarConfig } from "@/lib/types";

const VALID_SHAPES     = new Set(["spray-can", "robot", "alien", "cat"]);
const VALID_ACCESSORIES = new Set(["cap", "sunglasses", "headphones", "crown", "none"]);

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    username?: string;
    avatar_config?: AvatarConfig;
  };

  const username = body.username?.trim();
  const cfg      = body.avatar_config;

  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });
  if (username.length > 20) return NextResponse.json({ error: "Username too long" }, { status: 400 });

  if (!cfg || !VALID_SHAPES.has(cfg.shape) || !VALID_ACCESSORIES.has(cfg.accessory) || !cfg.color) {
    return NextResponse.json({ error: "Invalid avatar config" }, { status: 400 });
  }

  const player = await updatePlayerProfile(userId, username, cfg);
  return NextResponse.json({ player });
}
