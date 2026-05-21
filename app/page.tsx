import Image from "next/image";
import Link from "next/link";
import WeeklyChampion from "@/components/WeeklyChampion";
import { getLatestChampion, getWeeklyLeaderboard } from "@/lib/db";

export default async function LandingPage() {
  const [champion, board] = await Promise.all([
    getLatestChampion().catch(() => null),
    getWeeklyLeaderboard(0).catch(() => []),
  ]);

  const COLORS = ["text-mm-gold", "text-gray-300", "text-mm-orange"];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-16">

      {/* Logo + tagline */}
      <div className="flex flex-col items-center gap-4">
        <Image src="/logo.png" alt="Mix Master" width={300} height={150} priority />
        <p className="font-boogaloo text-xl text-center text-gray-400 max-w-md">
          Daily mini-games. Weekly glory. Only for those who show up.
        </p>
      </div>

      {/* CTA */}
      <div className="flex gap-4">
        <Link
          href="/login"
          className="font-marker px-8 py-3 rounded-xl bg-mm-pink text-white shadow-[0_0_22px_rgba(255,45,120,.5)] hover:scale-105 transition-transform"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="font-marker px-8 py-3 rounded-xl border-2 border-mm-cyan text-mm-cyan hover:bg-mm-cyan hover:text-black transition-colors"
        >
          Register
        </Link>
      </div>

      {/* Last week's champion */}
      <div className="w-full max-w-md">
        <WeeklyChampion champion={champion} />
      </div>

      {/* This week's top 3 */}
      {board.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="font-marker text-mm-cyan text-xl mb-3 text-center">This Week&apos;s Leaders</h2>
          <div className="flex flex-col gap-2">
            {board.slice(0, 3).map((row, i) => (
              <div
                key={row.player_id}
                className="flex items-center gap-3 bg-mm-surface rounded-xl px-4 py-2.5 border border-white/10"
              >
                <span className={`font-marker text-sm w-5 text-center ${COLORS[i]}`}>
                  {i === 0 ? "👑" : i + 1}
                </span>
                <span className="font-boogaloo text-gray-200 flex-1 truncate">{row.username}</span>
                <span className="font-marker text-mm-pink text-sm">
                  {(row.total_score / 10).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </main>
  );
}
