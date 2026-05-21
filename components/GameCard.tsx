import Link from "next/link";

interface GameCardProps {
  title: string;
  description: string;
  color: string;
  href: string;
}

export default function GameCard({ title, description, color, href }: GameCardProps) {
  return (
    <Link
      href={href}
      className="group bg-mm-surface rounded-2xl p-6 border border-white/10 flex flex-col gap-3 hover:border-mm-pink/50 hover:shadow-[0_0_20px_rgba(255,45,120,.15)] transition-all"
    >
      <h2 className={`font-marker text-xl text-${color}`}>{title}</h2>
      <p className="font-boogaloo text-gray-400 text-sm flex-1">{description}</p>
      <span className={`font-boogaloo text-sm text-${color} group-hover:underline`}>
        Play now →
      </span>
    </Link>
  );
}
