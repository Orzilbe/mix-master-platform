"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";
import { io, Socket } from "socket.io-client";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;

type ServerState = "checking" | "starting" | "failed" | "ready";
type Phase = "joining" | "waiting" | "playing" | "dead" | "full" | "in-progress" | "game-over";

// ── Health check — wakes Render's free-tier server before connecting ────────
type HealthResult = { ok: true } | { ok: false; error: string };

async function pingHealth(signal: AbortSignal): Promise<HealthResult> {
  try {
    const res = await fetch(`${GAME_SERVER}/health`, { signal, cache: "no-store" });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function JoinPage() {
  const { user, isLoaded } = useUser();
  const router              = useRouter();

  const [profileReady, setProfileReady] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);

  const [serverState, setServerState] = useState<ServerState>("checking");
  const [retryKey, setRetryKey]       = useState(0);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [phase, setPhase]         = useState<Phase>("joining");
  const [myColor, setMyColor]     = useState("#FF2D78");
  const [respawnCount, setRespawn] = useState(0);
  const [rank, setRank]           = useState<number | null>(null);
  const [pct, setPct]             = useState("0");
  const [winnerName, setWinner]   = useState<string | null>(null);

  const socketRef    = useRef<Socket | null>(null);
  const mySlotRef    = useRef<number | null>(null);
  const respawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef     = useRef<Phase>("joining");
  phaseRef.current   = phase;

  useEffect(() => {
    if (isLoaded && !user) router.replace("/login");
  }, [isLoaded, user, router]);

  // ── Profile check — redirect to /setup-profile if avatar not configured ──
  useEffect(() => {
    if (!isLoaded || !user) return;

    fetch("/api/profile/me")
      .then(r => r.json())
      .then(({ player }) => {
        if (!player?.avatar_config) {
          router.replace("/setup-profile");
          return;
        }
        setAvatarConfig(player.avatar_config as AvatarConfig);
        setProfileReady(true);
      })
      .catch(() => setProfileReady(true)); // On error, proceed without avatar
  }, [isLoaded, user, router]);

  // ── Phase 1: health check ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user || !profileReady) return;
    setServerState("checking");
    setHealthError(null);

    let cancelled = false;
    const abortControllers: AbortController[] = [];
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = async (tries: number) => {
      if (cancelled) return;
      const ac = new AbortController();
      abortControllers.push(ac);
      const timeoutId = setTimeout(() => ac.abort(), 20_000);
      const result    = await pingHealth(ac.signal);
      clearTimeout(timeoutId);
      if (cancelled) return;

      if (result.ok) { setServerState("ready"); return; }

      setHealthError(result.error);
      if (tries === 0) setServerState("starting");
      if (tries >= 2)  { setServerState("failed"); return; }
      retryTimer = setTimeout(() => attempt(tries + 1), 20_000);
    };

    attempt(0);
    return () => {
      cancelled = true;
      abortControllers.forEach(c => c.abort());
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isLoaded, user, profileReady, retryKey]);

  // ── Phase 2: Socket.io ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user || serverState !== "ready") return;

    const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("lobby-join", {
        userId:       user.id,
        username:     user.username ?? user.firstName ?? "Player",
        avatarUrl:    user.imageUrl ?? null,
        avatarConfig: avatarConfig,
      });
    });

    socket.on("connect_error", () => setServerState("failed"));

    socket.on("lobby-join-ack", ({ slotId, color }: { slotId: number; color: string }) => {
      mySlotRef.current = slotId;
      setMyColor(color);
      setPhase("waiting");
    });

    socket.on("lobby-full",       () => setPhase("full"));
    socket.on("game-in-progress", () => setPhase("in-progress"));

    socket.on("game-start", () => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setPhase("playing");
    });

    socket.on("leaderboard-update", (board: { id: number; rank: number; pct: string }[]) => {
      const me = board.find(p => p.id === mySlotRef.current);
      if (me) { setRank(me.rank); setPct(me.pct); }
    });

    socket.on("player-died", ({ respawnIn }: { respawnIn: number }) => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setPhase("dead");
      let t = respawnIn;
      setRespawn(t);
      respawnTimer.current = setInterval(() => {
        t -= 1;
        setRespawn(Math.max(0, t));
        if (t <= 0) { clearInterval(respawnTimer.current!); setPhase("playing"); }
      }, 1000);
    });

    socket.on("game-end", ({ winner }: { winner: { name: string } | null }) => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setWinner(winner?.name ?? null);
      setPhase("game-over");
    });

    return () => {
      socket.disconnect();
      if (respawnTimer.current) clearInterval(respawnTimer.current);
    };
  }, [isLoaded, user, serverState]);

  const sendDir = useCallback((dir: string) => {
    if (phaseRef.current !== "playing") return;
    socketRef.current?.emit("player-input", { direction: dir });
  }, []);

  const retry = () => { setHealthError(null); setRetryKey(k => k + 1); };

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (!isLoaded || !user || !profileReady) return <Centered><Spinner /></Centered>;

  if (serverState === "checking") {
    return <Centered><Spinner /><Muted>Connecting to game server…</Muted></Centered>;
  }
  if (serverState === "starting") {
    return (
      <Centered>
        <Spinner />
        <p className="font-marker text-mm-cyan text-xl">Waking up…</p>
        <Muted>Game server is starting up, please wait.</Muted>
        <Muted>This can take up to 30 seconds on the first scan.</Muted>
      </Centered>
    );
  }
  if (serverState === "failed") {
    return (
      <Centered>
        <p className="font-marker text-mm-orange text-2xl">No Connection</p>
        <Muted>Could not reach the game server.</Muted>
        {healthError && (
          <p className="font-mono text-xs text-red-400 bg-black/40 px-3 py-2 rounded-lg max-w-xs break-all">
            {healthError}
          </p>
        )}
        <a
          href={`${GAME_SERVER}/health`}
          target="_blank"
          rel="noreferrer"
          className="font-boogaloo text-mm-cyan text-sm underline underline-offset-2"
        >
          Wake the server manually ↗
        </a>
        <button
          onClick={retry}
          className="mt-2 font-boogaloo text-lg px-8 py-3 rounded-xl text-white"
          style={{ background: "#FF2D78", boxShadow: "0 0 20px rgba(255,45,120,.5)" }}
        >
          Retry
        </button>
      </Centered>
    );
  }

  if (phase === "joining")     return <Centered><Spinner /><Muted>Joining…</Muted></Centered>;
  if (phase === "full")        return <Centered><Headline color="#FF6D00">Game Full</Headline><Muted>All 4 slots are taken. Try again next round.</Muted></Centered>;
  if (phase === "in-progress") return <Centered><Headline color="#00E5FF">Game In Progress</Headline><Muted>Wait for the current round to finish, then scan again.</Muted></Centered>;
  if (phase === "game-over")   return (
    <Centered>
      <Headline color="#FF6D00">GAME OVER</Headline>
      {winnerName && <p className="font-boogaloo text-white text-2xl">{winnerName} wins!</p>}
      <Muted>Scan the QR code again to join the next round.</Muted>
    </Centered>
  );

  if (phase === "waiting") {
    const name = user.username ?? user.firstName ?? "Player";
    return (
      <Centered>
        {/* Avatar with color glow ring */}
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width:     "9rem",
            height:    "9rem",
            background: `${myColor}18`,
            border:    `3px solid ${myColor}`,
            boxShadow: `0 0 48px ${myColor}66`,
          }}
        >
          <PlayerAvatar config={{ ...avatarConfig, color: myColor }} size={104} />
        </div>
        <h1 className="font-marker text-2xl text-white">{name}</h1>
        <p className="font-boogaloo text-xl" style={{ color: myColor }}>YOU&apos;RE IN! 🎨</p>
        <Muted>Waiting for host to start…</Muted>
      </Centered>
    );
  }

  /* ── Playing / Dead — Joystick ───────────────────────────────────────── */
  const name = user.username ?? user.firstName ?? "Player";

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#0d0d0d", touchAction: "none",
               userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
    >
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: "rgba(0,0,0,.65)", borderBottom: `2px solid ${myColor}` }}>
        <span className="font-marker text-lg" style={{ color: myColor }}>{name}</span>
        <span className="font-boogaloo text-gray-300 text-sm">
          <span className="font-marker" style={{ color: myColor }}>#{rank ?? "–"}</span>
          &nbsp;|&nbsp;{pct}%
        </span>
      </div>

      {/* Joystick area */}
      <div className="flex-1 flex items-center justify-center">
        <Joystick color={myColor} onDirection={sendDir} />
      </div>

      {/* Death overlay */}
      {phase === "dead" && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
          <p className="font-marker text-4xl"
            style={{ color: "#FF6D00", textShadow: "0 0 20px #FF6D00" }}>SPRAYED!</p>
          <p className="font-boogaloo text-xl text-gray-300">
            Back in <span className="font-marker" style={{ color: "#FF6D00" }}>{respawnCount}</span>s…
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Joystick component ─────────────────────────────────────────────────── */

const BASE_R  = 100;  // base radius  (200px diameter)
const THUMB_R = 40;   // thumb radius (80px  diameter)
const DEAD_Z  = 18;   // dead-zone before direction registers
const MAX_TRAVEL = BASE_R - THUMB_R;   // how far thumb can move from center

function Joystick({ color, onDirection }: { color: string; onDirection: (dir: string) => void }) {
  const baseRef    = useRef<HTMLDivElement>(null);
  const dirRef     = useRef<string | null>(null);
  const [pos, setPos]       = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const getCenter = () => {
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const move = (touch: Touch) => {
      const c  = getCenter();
      const dx = touch.clientX - c.x;
      const dy = touch.clientY - c.y;
      const dist = Math.hypot(dx, dy);

      // Clamp thumb within base circle
      const clamped = Math.min(dist, MAX_TRAVEL);
      const angle   = Math.atan2(dy, dx);
      setPos({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

      if (dist < DEAD_Z) {
        dirRef.current = null;
        return;
      }

      // Snap to 4 directions — use angle ranges matching the user's spec
      // (atan2 with inverted y gives mathematical angles: right=0, up=90, left=180, down=270)
      const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
      const newDir =
        deg >= 315 || deg < 45  ? "right" :
        deg >= 45  && deg < 135 ? "up"    :
        deg >= 135 && deg < 225 ? "left"  :
                                  "down";

      if (newDir !== dirRef.current) {
        dirRef.current = newDir;
        onDirection(newDir);
      }
    };

    const onStart = (e: TouchEvent) => {
      e.preventDefault();
      setActive(true);
      move(e.touches[0]);
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      move(e.touches[0]);
    };

    const onEnd = (e: TouchEvent) => {
      e.preventDefault();
      setActive(false);
      setPos({ x: 0, y: 0 });
      dirRef.current = null;
    };

    base.addEventListener("touchstart",  onStart, { passive: false });
    base.addEventListener("touchmove",   onMove,  { passive: false });
    base.addEventListener("touchend",    onEnd,   { passive: false });
    base.addEventListener("touchcancel", onEnd,   { passive: false });

    return () => {
      base.removeEventListener("touchstart",  onStart);
      base.removeEventListener("touchmove",   onMove);
      base.removeEventListener("touchend",    onEnd);
      base.removeEventListener("touchcancel", onEnd);
    };
  }, [onDirection]);

  return (
    <div
      ref={baseRef}
      style={{
        width:        BASE_R * 2,
        height:       BASE_R * 2,
        borderRadius: "50%",
        background:   "rgba(0,0,0,0.45)",
        border:       `3px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
        boxShadow:    active ? `0 0 40px ${color}55, inset 0 0 20px ${color}22` : "none",
        position:     "relative",
        transition:   "border-color 0.1s, box-shadow 0.1s",
        touchAction:  "none",
        flexShrink:   0,
      }}
    >
      {/* Thumb */}
      <div
        style={{
          width:        THUMB_R * 2,
          height:       THUMB_R * 2,
          borderRadius: "50%",
          background:   color,
          boxShadow:    `0 0 24px ${color}99`,
          position:     "absolute",
          top:          "50%",
          left:         "50%",
          transform:    `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          transition:   active ? "none" : "transform 0.18s cubic-bezier(.22,1,.36,1)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/* ── Shared UI helpers ──────────────────────────────────────────────────── */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-mm-bg flex flex-col items-center justify-center gap-6 px-6 text-center">
      {children}
    </div>
  );
}

function Headline({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <p className="font-marker text-3xl" style={{ color, textShadow: `0 0 20px ${color}` }}>
      {children}
    </p>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="font-boogaloo text-white/40 text-base">{children}</p>;
}

function Spinner() {
  return <div className="w-8 h-8 border-4 border-mm-cyan border-t-transparent rounded-full animate-spin" />;
}
