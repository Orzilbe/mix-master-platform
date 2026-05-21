import type { WeeklyChampion as WC } from "@/lib/types";

interface Props {
  champion: WC | null;
}

export default function WeeklyChampion({ champion }: Props) {
  if (!champion) {
    return (
      <section className="bg-mm-surface rounded-2xl p-6 border border-mm-gold/30 flex items-center gap-5">
        <div className="text-4xl">👑</div>
        <div>
          <p className="font-marker text-mm-gold text-xl">Last Week&apos;s Champion</p>
          <p className="font-boogaloo text-gray-400">No champion yet — compete this week!</p>
        </div>
      </section>
    );
  }

  const name  = champion.players?.username ?? "Unknown";
  const score = (champion.total_score / 10).toFixed(1);

  return (
    <section className="bg-mm-surface rounded-2xl p-6 border border-mm-gold/40 shadow-[0_0_28px_rgba(255,215,0,.12)] flex items-center gap-5">
      <div className="text-5xl leading-none">👑</div>
      <div className="flex-1">
        <p className="font-boogaloo text-mm-gold text-xs uppercase tracking-widest mb-1">
          Week {champion.week_number} Champion
        </p>
        <p className="font-marker text-2xl text-white">{name}</p>
        <p className="font-boogaloo text-gray-400 text-sm mt-0.5">
          {score}% avg territory · {champion.total_score} pts total
        </p>
      </div>
    </section>
  );
}
