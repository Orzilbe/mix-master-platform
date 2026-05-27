import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Public endpoint — returns the caller's Clerk user ID.
// Useful for finding your own ID to add as an admin:
//   Vercel → Settings → Environment Variables → ADMIN_USER_IDS=user_abc123,user_xyz789
export async function GET() {
  const { userId } = auth();
  return NextResponse.json({ clerkId: userId ?? null });
}
