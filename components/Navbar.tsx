import Image from "next/image";
import Link from "next/link";
import NavbarUser from "./NavbarUser";

export default function Navbar() {
  return (
    <nav className="w-full bg-mm-surface border-b border-white/10 px-6 py-3 flex items-center justify-between">
      <Link href="/hub" className="flex items-center gap-3">
        <Image src="/logo.png" alt="Mix Master" width={48} height={24} />
        <span className="font-marker text-mm-pink text-lg hidden sm:block">Mix Master</span>
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/hub"         className="font-boogaloo text-gray-300 hover:text-mm-cyan transition-colors">Hub</Link>
        <Link href="/leaderboard" className="font-boogaloo text-gray-300 hover:text-mm-cyan transition-colors">Leaderboard</Link>
        <Link href="/profile"     className="font-boogaloo text-gray-300 hover:text-mm-cyan transition-colors">Profile</Link>
        <NavbarUser />
      </div>
    </nav>
  );
}
