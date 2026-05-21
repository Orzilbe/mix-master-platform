import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import WeeklyStandings from "@/components/WeeklyStandings";
import JoinGameButton from "@/components/JoinGameButton";
import {
  getWeeklyLeaderboard,
  getPlayer,
  getPlayerWeeklyScore,
  getActiveTokenColors,
  SLOT_COLORS,
} from "@/lib/db";

function isMobile(): boolean {
  const ua = headers().get("user-agent") ?? "";
  return /mobile|android|iphone|ipad|blackberry|windows\s*phone/i.test(ua);
}

// ── Mobile view ───────────────────────────────────────────────────────────────

async function MobileHub({ userId }: { userId: string }) {
  const [clerkUser, player, takenColors] = await Promise.all([
    currentUser(),
    getPlayer(userId),
    getActiveTokenColors().catch(() => []),
  ]);

  const username = clerkUser?.username ?? clerkUser?.firstName ?? "Player";
  const avatar   = clerkUser?.imageUrl ?? null;

  let weekScore = 0;
  if (player) weekScore = await getPlayerWeeklyScore(player.id).catch(() => 0);

  const taken       = new Set(takenColors);
  const previewColor = SLOT_COLORS.find(c => !taken.has(c)) ?? SLOT_COLORS[0];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center gap-10 px-6 py-10">

        {/* Player identity */}
        <div className="flex flex-col items-center gap-3">
          {avatar ? (
            <Image
              src={avatar}
              alt={username}
              width={96}
              height={96}
              className="rounded-full"
              style={{ outline: `4px solid ${previewColor}`, outlineOffset: "3px" }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full bg-mm-surface flex items-center justify-center font-marker text-3xl"
              style={{ color: previewColor, outline: `4px solid ${previewColor}`, outlineOffset: "3px" }}
            >
              {username[0].toUpperCase()}
            </div>
          )}
          <h1 className="font-marker text-2xl text-white">{username}</h1>
        </div>

        {/* Weekly score */}
        <div className="text-center">
          <p className="font-boogaloo text-gray-400 text-xs uppercase tracking-widest mb-1">
            This week
          </p>
          <p className="font-marker text-5xl" style={{ color: previewColor }}>
            {(weekScore / 10).toFixed(1)}%
          </p>
        </div>

        {/* JOIN button */}
        <JoinGameButton previewColor={previewColor} />

        <p className="font-boogaloo text-gray-500 text-xs text-center max-w-xs leading-relaxed">
          Tap JOIN — your phone becomes the controller.
          Use your username <span className="text-white">{username}</span> when entering your name in-game.
        </p>

      </main>
    </div>
  );
}

// ── Desktop view ──────────────────────────────────────────────────────────────

async function DesktopHub() {
  const board = await getWeeklyLeaderboard().catch(() => []);

  const host        = headers().get("host") ?? "localhost:3000";
  const proto       = host.startsWith("localhost") ? "http" : "https";
  const hubUrl      = `${proto}://${host}/hub`;
  const qrSrc       = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=111111&bgcolor=ffffff&data=${encodeURIComponent(hubUrl)}`;
  const gameBase    = process.env.GAME_SERVER_URL ?? "https://mix-master-8gh1.onrender.com";

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 flex gap-4 p-4 min-h-0">

        {/* Game display iframe */}
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/10">
          <iframe
            src={`${gameBase}/display`}
            className="w-full h-full border-0"
            title="Mix Master Arena"
          />
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* QR card */}
          <div className="bg-mm-surface rounded-xl p-4 border border-mm-pink/30 flex flex-col items-center gap-3">
            <h2 className="font-marker text-mm-pink text-lg">Join on Your Phone</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="Scan to join"
              width={200}
              height={200}
              className="rounded-lg border-4 border-white"
            />
            <p className="font-boogaloo text-gray-400 text-xs text-center leading-relaxed">
              Scan → log in → press JOIN GAME
            </p>
          </div>

          {/* Live standings */}
          <WeeklyStandings initialBoard={board} />

        </div>
      </div>
    </div>
  );
}

// ── Page entry ────────────────────────────────────────────────────────────────

export default async function HubPage() {
  const { userId } = auth();
  if (!userId) redirect("/login");

  return isMobile() ? <MobileHub userId={userId} /> : <DesktopHub />;
}
