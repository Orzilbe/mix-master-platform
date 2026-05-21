"use client";

import { useEffect, useState } from "react";
import type { WeeklyLeaderboardRow } from "@/lib/types";

function msUntilWeekEnd(): number {
  const now = new Date();
  // ISO week ends Sunday 23:59:59 UTC
  const day          = now.getUTCDay();              // 0=Sun
  const daysLeft     = day === 0 ? 0 : 7 - day;
  const end          = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(),
    now.getUTCDate() + daysLeft, 23, 59, 59,
  ));
  return Math.max(0, end.getTime() - Date.now());
}

function fmt(ms: number): string {
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function WeeklyStandings({ initialBoard }: { initialBoard: WeeklyLeaderboardRow[] }) {
  const [countdown, setCountdown] = useState(() => fmt(msUntilWeekEnd()));

  useEffect(() => {
    const id = setInterval(() => setCountdown(fmt(msUntilWeekEnd())), 1000);
    return () => clearInterval(id);
  }, []);

  const COLORS = ["text-mm-gold", "text-gray-300", "text-mm-orange"];

  return (
    <aside className="flex flex-col gap-4">
      {/* Countdown */}
      <div className="bg-mm-surface rounded-xl p-4 border border-mm-gold/30 text-center">
        <p className="font-boogaloo text-xs text-gray-400 uppercase tracking-wider mb-1">
          Week resets in
        </p>
        <p className="font-marker text-mm-gold text-xl tabular-nums">{countdown}</p>
      </div>

      {/* Leaderboard */}
      <div className="bg-mm-surface rounded-xl p-4 border border-white/10">
        <h2 className="font-marker text-mm-cyan text-lg mb-3">This Week</h2>
        {initialBoard.length === 0 ? (
          <p className="font-boogaloo text-gray-500 text-sm">No games yet — be first!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {initialBoard.slice(0, 10).map((row, i) => (
              <div key={row.player_id} className="flex items-center gap-2 py-1">
                <span className={`font-marker text-sm w-5 text-center ${COLORS[i] ?? "text-gray-400"}`}>
                  {i === 0 ? "👑" : i + 1}
                </span>
                <span className="font-boogaloo text-sm text-gray-200 flex-1 truncate">
                  {row.username}
                </span>
                <span className="font-marker text-sm text-mm-pink">
                  {row.total_score}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
