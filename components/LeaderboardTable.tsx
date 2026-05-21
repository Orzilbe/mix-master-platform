import type { WeeklyLeaderboardRow } from "@/lib/types";

const MEDAL = ["👑", "🥈", "🥉"];

interface Props {
  rows: WeeklyLeaderboardRow[];
  emptyMessage?: string;
}

export default function LeaderboardTable({ rows, emptyMessage = "No games yet." }: Props) {
  if (rows.length === 0) {
    return <p className="font-boogaloo text-gray-500 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const pct = (row.total_score / 10).toFixed(1);
        return (
          <div
            key={row.player_id}
            className={`flex items-center gap-4 rounded-xl px-5 py-3 border transition-colors ${
              i === 0
                ? "bg-mm-gold/10 border-mm-gold/30"
                : "bg-mm-surface border-white/10"
            }`}
          >
            {/* Rank */}
            <span className="font-marker text-lg w-7 text-center shrink-0">
              {MEDAL[i] ?? <span className="text-gray-500 text-sm">{i + 1}</span>}
            </span>

            {/* Name */}
            <span className="font-boogaloo text-gray-200 flex-1 truncate">{row.username}</span>

            {/* Games played */}
            <span className="font-boogaloo text-gray-500 text-xs hidden sm:block shrink-0">
              {row.games_played}g
            </span>

            {/* Score */}
            <span className="font-marker text-mm-pink shrink-0">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
