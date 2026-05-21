"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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

  // Server wake-up state
  const [serverState, setServerState] = useState<ServerState>("checking");
  const [retryKey, setRetryKey]       = useState(0);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Game state
  const [phase, setPhase]           = useState<Phase>("joining");
  const [myColor, setMyColor]       = useState("#FF2D78");
  const [respawnCount, setRespawn]  = useState(0);
  const [rank, setRank]             = useState<number | null>(null);
  const [pct, setPct]               = useState("0");
  const [winnerName, setWinner]     = useState<string | null>(null);
  const [activeDir, setActiveDir]   = useState<string | null>(null);

  const socketRef    = useRef<Socket | null>(null);
  const mySlotRef    = useRef<number | null>(null);
  const respawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef     = useRef<Phase>("joining");
  phaseRef.current   = phase;

  // Redirect unauthenticated users (belt-and-suspenders — middleware handles it too)
  useEffect(() => {
    if (isLoaded && !user) router.replace("/login");
  }, [isLoaded, user, router]);

  // ── Phase 1: health check with progressive messaging ─────────────────────
  useEffect(() => {
    if (!isLoaded || !user) return;
    setServerState("checking");

    let cancelled = false;
    const controllers: AbortController[] = [];
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = async (tries: number) => {
      if (cancelled) return;
      const ac = new AbortController();
      controllers.push(ac);

      // Generous timeout: server may take up to 20s to wake on Render free tier
      const timeoutId = setTimeout(() => ac.abort(), 20_000);
      const result = await pingHealth(ac.signal);
      clearTimeout(timeoutId);

      if (cancelled) return;

      if (result.ok) {
        setHealthError(null);
        setServerState("ready");
        return;
      }

      setHealthError(result.error);

      // First failure → tell user server is waking up
      if (tries === 0) setServerState("starting");
      // Three failures (~60s total) → give up and show retry button
      if (tries >= 2) { setServerState("failed"); return; }

      retryTimer = setTimeout(() => attempt(tries + 1), 20_000);
    };

    attempt(0);

    return () => {
      cancelled = true;
      controllers.forEach(c => c.abort());
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isLoaded, user, retryKey]);

  // ── Phase 2: Socket.io — only once server is confirmed alive ─────────────
  useEffect(() => {
    if (!isLoaded || !user || serverState !== "ready") return;

    const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    // Emit lobby-join only after the connection is established
    socket.on("connect", () => {
      socket.emit("lobby-join", {
        userId:    user.id,
        username:  user.username ?? user.firstName ?? "Player",
        avatarUrl: user.imageUrl ?? null,
      });
    });

    socket.on("connect_error", () => {
      // Server was alive at health check but socket failed — treat as failed
      setServerState("failed");
    });

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

  const retry = () => setRetryKey(k => k + 1);

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (!isLoaded || !user) {
    return <Centered><Spinner /></Centered>;
  }

  // ── Server wake-up screens ────────────────────────────────────────────────
  if (serverState === "checking") {
    return (
      <Centered>
        <Spinner />
        <Muted>Connecting to game server…</Muted>
      </Centered>
    );
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

        {/* Debug: show exact error from fetch */}
        {healthError && (
          <p className="font-mono text-xs text-red-400 bg-black/40 px-3 py-2 rounded-lg max-w-xs break-all">
            {healthError}
          </p>
        )}

        {/* Manual wake link — opens health URL directly in browser, bypassing CORS */}
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

  // ── Game phase screens ─────────────────────────────────────────────────────
  if (phase === "joining") {
    return <Centered><Spinner /><Muted>Joining…</Muted></Centered>;
  }

  if (phase === "full") {
    return (
      <Centered>
        <Headline color="#FF6D00">Game Full</Headline>
        <Muted>All 4 slots are taken. Try again next round.</Muted>
      </Centered>
    );
  }

  if (phase === "in-progress") {
    return (
      <Centered>
        <Headline color="#00E5FF">Game In Progress</Headline>
        <Muted>Wait for the current round to finish, then scan again.</Muted>
      </Centered>
    );
  }

  if (phase === "game-over") {
    return (
      <Centered>
        <Headline color="#FF6D00">GAME OVER</Headline>
        {winnerName && <p className="font-boogaloo text-white text-2xl">{winnerName} wins!</p>}
        <Muted>Scan the QR code again to join the next round.</Muted>
      </Centered>
    );
  }

  if (phase === "waiting") {
    const name = user.username ?? user.firstName ?? "Player";
    return (
      <Centered>
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={name}
            width={100}
            height={100}
            className="rounded-full"
            style={{ outline: `4px solid ${myColor}`, outlineOffset: "4px" }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center font-marker text-3xl"
            style={{ background: myColor }}
          >
            {name[0].toUpperCase()}
          </div>
        )}
        <h1 className="font-marker text-2xl text-white">{name}</h1>
        <div
          className="w-20 h-20 rounded-full border-4 border-white/20"
          style={{ background: myColor, boxShadow: `0 0 40px ${myColor}80` }}
        />
        <p className="font-boogaloo text-xl" style={{ color: myColor }}>
          YOU&apos;RE IN! 🎨
        </p>
        <Muted>Waiting for host to start…</Muted>
      </Centered>
    );
  }

  /* ── Playing / Dead — D-pad ──────────────────────────────────────────── */
  const name = user.username ?? user.firstName ?? "Player";

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#0d0d0d", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
    >
      {/* HUD */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: "rgba(0,0,0,.65)", borderBottom: `2px solid ${myColor}` }}
      >
        <span className="font-marker text-lg" style={{ color: myColor }}>{name}</span>
        <span className="font-boogaloo text-gray-300 text-sm">
          <span className="font-marker" style={{ color: myColor }}>#{rank ?? "–"}</span>
          &nbsp;|&nbsp;{pct}%
        </span>
      </div>

      {/* D-pad — 3×3 grid */}
      <div
        className="flex-1 grid gap-2 p-3"
        style={{ gridTemplateColumns: "1fr .5fr 1fr", gridTemplateRows: "1fr .5fr 1fr" }}
      >
        <Corner />
        <DpadBtn dir="up"    color={myColor} active={activeDir === "up"}    sendDir={sendDir} setActive={setActiveDir}>▲</DpadBtn>
        <Corner />

        <DpadBtn dir="left"  color={myColor} active={activeDir === "left"}  sendDir={sendDir} setActive={setActiveDir}>◀</DpadBtn>
        <div className="rounded-full bg-[#161616] border-2 border-[#252525] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="7" fill={myColor} opacity=".55" />
          </svg>
        </div>
        <DpadBtn dir="right" color={myColor} active={activeDir === "right"} sendDir={sendDir} setActive={setActiveDir}>▶</DpadBtn>

        <Corner />
        <DpadBtn dir="down"  color={myColor} active={activeDir === "down"}  sendDir={sendDir} setActive={setActiveDir}>▼</DpadBtn>
        <Corner />
      </div>

      {/* Death overlay */}
      {phase === "dead" && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
          <p className="font-marker text-4xl" style={{ color: "#FF6D00", textShadow: "0 0 20px #FF6D00" }}>
            SPRAYED!
          </p>
          <p className="font-boogaloo text-xl text-gray-300">
            Back in <span className="font-marker" style={{ color: "#FF6D00" }}>{respawnCount}</span>s…
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

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

function Corner() {
  return <div className="rounded-2xl bg-[#111] border border-[#1c1c1c]" />;
}

function DpadBtn({
  dir, color, active, sendDir, setActive, children,
}: {
  dir: string; color: string; active: boolean;
  sendDir: (d: string) => void; setActive: (d: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl text-white text-[2.4rem]"
      style={{
        background:              active ? color : "#161616",
        border:                  `2px solid ${active ? color : "#272727"}`,
        transform:               active ? "scale(.93)" : "scale(1)",
        transition:              "background .07s, transform .07s, border-color .07s",
        cursor:                  "pointer",
        WebkitTapHighlightColor: "transparent",
      } as React.CSSProperties}
      onPointerDown={e => { e.preventDefault(); setActive(dir); sendDir(dir); }}
      onPointerUp={() => setActive(null)}
      onPointerLeave={() => setActive(null)}
      onPointerCancel={() => setActive(null)}
    >
      {children}
    </div>
  );
}
