import Navbar from "@/components/Navbar";
import LeaderboardTable from "@/components/LeaderboardTable";
import WeeklyChampion from "@/components/WeeklyChampion";
import { getLatestChampion, getWeeklyLeaderboard, getAllTimeLeaderboard } from "@/lib/db";

export default async function LeaderboardPage() {
  const [champion, thisWeek, lastWeek, allTime] = await Promise.all([
    getLatestChampion().catch(() => null),
    getWeeklyLeaderboard(0).catch(() => []),
    getWeeklyLeaderboard(-1).catch(() => []),
    getAllTimeLeaderboard().catch(() => []),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-10">

        <WeeklyChampion champion={champion} />

        <section>
          <h2 className="font-marker text-2xl text-mm-cyan mb-4">This Week</h2>
          <LeaderboardTable rows={thisWeek} emptyMessage="No games yet — be the first!" />
        </section>

        {lastWeek.length > 0 && (
          <section>
            <h2 className="font-marker text-2xl text-gray-400 mb-4">Last Week</h2>
            <LeaderboardTable rows={lastWeek} />
          </section>
        )}

        {allTime.length > 0 && (
          <section>
            <h2 className="font-marker text-2xl text-mm-orange mb-4">All Time</h2>
            <div className="flex flex-col gap-2">
              {allTime.map((row, i) => {
                const MEDAL = ["👑", "🥈", "🥉"];
                const pct   = (row.total_score / 10).toFixed(1);
                return (
                  <div
                    key={row.player_id}
                    className={`flex items-center gap-4 rounded-xl px-5 py-3 border ${
                      i === 0 ? "bg-mm-orange/10 border-mm-orange/30" : "bg-mm-surface border-white/10"
                    }`}
                  >
                    <span className="font-marker text-lg w-7 text-center shrink-0">
                      {MEDAL[i] ?? <span className="text-gray-500 text-sm">{i + 1}</span>}
                    </span>
                    <span className="font-boogaloo text-gray-200 flex-1 truncate">{row.username}</span>
                    <span className="font-boogaloo text-gray-500 text-xs hidden sm:block shrink-0">
                      {row.games_played}g
                    </span>
                    <span className="font-marker text-mm-orange shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
