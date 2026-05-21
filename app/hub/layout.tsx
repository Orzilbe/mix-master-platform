import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreatePlayer } from "@/lib/db";

// Runs before every /hub/** page — syncs Clerk user → Supabase players table
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/login");

  try {
    const user = await currentUser();
    if (user) {
      const username =
        user.username ??
        user.firstName ??
        `Player${userId.slice(-4)}`;
      await getOrCreatePlayer(userId, username, user.imageUrl ?? null);
    }
  } catch {
    // Non-fatal: don't block the page if DB is unreachable
  }

  return <>{children}</>;
}
