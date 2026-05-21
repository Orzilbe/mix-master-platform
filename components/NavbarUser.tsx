"use client";

import { useUser, UserButton } from "@clerk/nextjs";

export default function NavbarUser() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />;
  }
  if (!user) return null;

  const name = user.username ?? user.firstName ?? "Player";

  return (
    <div className="flex items-center gap-3">
      <span className="font-boogaloo text-sm text-gray-300 hidden sm:block">{name}</span>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
}
