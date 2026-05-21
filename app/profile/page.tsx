import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { getPlayer, getPlayerGameHistory } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export default async function ProfilePage() {
  const { userId } = auth();
  if (!userId) redirect("/login");

  const [clerkUser, player] = await Promise.all([
    currentUser(),
    getPlayer(userId),
  ]);

  let gamesPlayed = 0;
  let bestScore   = 0;
  let weekScore   = 0;
  let history: { id: string; score: number; played_at: string }[] = [];

  if (player) {
    const [statsRes, historyRes] = await Promise.all([
      supabase
        .from("game_sessions")
        .select("score, played_at")
        .eq("player_id", player.id)
        .order("score", { ascending: false }),
      getPlayerGameHistory(player.id, 8),
    ]);

    const sessions = statsRes.data ?? [];
    gamesPlayed = sessions.length;
    bestScore   = sessions[0]?.score ?? 0;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekScore = sessions
      .filter(s => new Date(s.played_at) >= weekAgo)
      .reduce((sum, s) => sum + s.score, 0);

    history = historyRes;
  }

  const name  = clerkUser?.username ?? clerkUser?.firstName ?? "Player";
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto w-full px-4 py-10 flex flex-col gap-8">

        {/* Avatar + name */}
        <div className="flex items-center gap-5">
          {clerkUser?.imageUrl ? (
            <Image
              src={clerkUser.imageUrl}
              alt={name}
              width={72}
              height={72}
              className="rounded-full ring-2 ring-mm-pink"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-mm-surface ring-2 ring-mm-pink flex items-center justify-center font-marker text-2xl text-mm-pink">
              {name[0].toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-marker text-3xl text-mm-cyan">{name}</h1>
            {email && <p className="font-boogaloo text-gray-400 text-sm mt-1">{email}</p>}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Games"      value={gamesPlayed}                       color="text-mm-pink" />
          <StatCard label="Best Game"  value={`${(bestScore / 10).toFixed(1)}%`} color="text-mm-cyan" />
          <StatCard label="This Week"  value={`${(weekScore / 10).toFixed(1)}%`} color="text-mm-gold" />
        </div>

        {/* Game history */}
        {history.length > 0 && (
          <section>
            <h2 className="font-marker text-xl text-mm-cyan mb-3">Recent Games</h2>
            <div className="flex flex-col gap-2">
              {history.map((s) => {
                const date = new Date(s.played_at);
                const pct  = (s.score / 10).toFixed(1);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-4 bg-mm-surface rounded-xl px-5 py-3 border border-white/10"
                  >
                    <div className="flex-1">
                      <p className="font-boogaloo text-gray-200 text-sm">Mix Master Arena</p>
                      <p className="font-boogaloo text-gray-500 text-xs">
                        {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="font-marker text-mm-pink">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {gamesPlayed === 0 && (
          <p className="font-boogaloo text-gray-500 text-center py-8">
            No games yet —{" "}
            <a href="/hub/play" className="text-mm-cyan hover:underline">
              play your first game
            </a>
            !
          </p>
        )}

      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-mm-surface rounded-xl p-5 border border-white/10 flex flex-col gap-1">
      <span className="font-boogaloo text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className={`font-marker text-3xl ${color}`}>{value}</span>
    </div>
  );
}
