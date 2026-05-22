"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";
import { io, Socket } from "socket.io-client";

import { GAMES, type GameSlug } from "@/lib/games";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;

type ServerState = "checking" | "starting" | "failed" | "ready";
type Phase       = "joining" | "waiting" | "playing" | "dead" | "full" | "in-progress" | "game-over";
type LocState    = "idle" | "checking" | "allowed" | "dev" | "denied" | "blocked";

type DailyGame = { gameSlug: GameSlug; gameName: string; gameColor: string; controllerUrl: string; isOverride: boolean } | null;

type MiniRow   = { rank: number; clerk_id: string; username: string; total_score: number };
type LiveScore = { id: number; rank: number; name: string; color: string; pct: string };

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
  const { signOut } = useClerk();
  const router              = useRouter();

  // ── Profile ──────────────────────────────────────────────────────────────
  const [profileReady, setProfileReady] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [weeklyRank,   setWeeklyRank]   = useState<number | null>(null);
  const [weeklyScore,  setWeeklyScore]  = useState(0);
  const avatarConfigRef = useRef<AvatarConfig>(DEFAULT_AVATAR);
  avatarConfigRef.current = avatarConfig;

  // ── Server health ────────────────────────────────────────────────────────
  const [serverState, setServerState] = useState<ServerState>("checking");
  const [retryKey,    setRetryKey]    = useState(0);
  const [healthError, setHealthError] = useState<string | null>(null);

  // ── Game state ───────────────────────────────────────────────────────────
  const [phase,        setPhase]   = useState<Phase>("joining");
  const [myColor,      setMyColor] = useState("#FF2D78");
  const [respawnCount, setRespawn] = useState(0);
  const [rank,         setRank]    = useState<number | null>(null);
  const [pct,          setPct]     = useState("0");
  const [winnerName,   setWinner]  = useState<string | null>(null);

  // ── Mode A: lobby mini-leaderboard ───────────────────────────────────────
  const [miniBoard,      setMiniBoard]      = useState<MiniRow[]>([]);
  const [boardCountdown, setBoardCountdown] = useState(30);

  // ── Mode C: spectator / queue ────────────────────────────────────────────
  const [liveScores,     setLiveScores]     = useState<LiveScore[]>([]);
  const [gameEnding,     setGameEnding]     = useState(false);
  const [queuePosition,  setQueuePosition]  = useState<number | null>(null);
  const [queueTotal,     setQueueTotal]     = useState(0);

  // Location check
  const [locState, setLocState] = useState<LocState>("idle");
  const [locInfo,  setLocInfo]  = useState<{ name: string; distance: number; radius: number } | null>(null);

  // Daily game
  const [dailyGame, setDailyGame] = useState<DailyGame>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const socketRef    = useRef<Socket | null>(null);
  const mySlotRef    = useRef<number | null>(null);
  const respawnTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef     = useRef<Phase>("joining");
  phaseRef.current   = phase;

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && !user) router.replace("/login");
  }, [isLoaded, user, router]);

  // ── Profile check — redirect to /setup-profile if avatar not configured ──
  useEffect(() => {
    if (!isLoaded || !user) return;

    fetch("/api/profile/me")
      .then(r => r.json())
      .then(({ player, weeklyRank: wr, weeklyScore: ws }) => {
        if (!player?.avatar_config) {
          router.replace("/setup-profile");
          return;
        }
        setAvatarConfig(player.avatar_config as AvatarConfig);
        setWeeklyRank(wr ?? null);
        setWeeklyScore(ws ?? 0);
        setProfileReady(true);
      })
      .catch(() => setProfileReady(true));
  }, [isLoaded, user, router]);

  // Location check — runs once profile is ready
  useEffect(() => {
    if (!isLoaded || !user || !profileReady) return;
    if (locState !== "idle") return;

    setLocState("checking");

    if (!navigator.geolocation) {
      setLocState("allowed");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res  = await fetch(`/api/location/check?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data.devMode) {
            setLocState("dev");
          } else if (data.allowed) {
            setLocState("allowed");
          } else {
            setLocInfo({ name: data.locationName, distance: data.distance, radius: data.radius });
            setLocState("blocked");
          }
        } catch {
          setLocState("allowed"); // if check fails, allow through
        }
      },
      () => setLocState("denied"),
      { timeout: 15_000, maximumAge: 60_000 },
    );
  }, [isLoaded, user, profileReady, locState]);

  // Phase 1: health check
  useEffect(() => {
    if (!isLoaded || !user || !profileReady) return;
    if (locState !== "allowed" && locState !== "dev") return;
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

      if (result.ok) {
        setServerState("ready");
        // Fetch today's active game
        fetch("/api/game/daily")
          .then(r => r.json())
          .then(d => setDailyGame(d))
          .catch(() => {});
        return;
      }

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
  }, [isLoaded, user, profileReady, locState, retryKey]);

  // ── Phase 2: Socket.io ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user || serverState !== "ready") return;

    const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    const emitJoin = () => {
      const cfg = avatarConfigRef.current;
      console.log("[join] emitting lobby-join", { userId: user.id, color: cfg.color, shape: cfg.shape });
      socket.emit("lobby-join", {
        userId:       user.id,
        username:     user.username ?? user.firstName ?? "Player",
        avatarUrl:    user.imageUrl ?? null,
        color:        cfg.color,
        avatarConfig: cfg,
      });
    };

    socket.on("connect",       emitJoin);
    socket.on("connect_error", () => setServerState("failed"));

    socket.on("lobby-join-ack", ({ slotId, color }: { slotId: number; color: string }) => {
      mySlotRef.current = slotId;
      setMyColor(color);
      setLiveScores([]);
      setGameEnding(false);
      setQueuePosition(null);
      setPhase("waiting");
    });

    // Server no longer emits lobby-full (uses queue-position instead), kept as fallback
    socket.on("lobby-full",       () => { setGameEnding(false); setPhase("full");        });
    socket.on("game-in-progress", () => { setGameEnding(false); setPhase("in-progress"); });

    // Queue position update — sent when waiting in line (lobby full or game running)
    socket.on("queue-position", ({ position, totalWaiting }: { position: number; totalWaiting: number }) => {
      setQueuePosition(position);
      setQueueTotal(totalWaiting);
      setGameEnding(false);
      // If still in "joining" phase, we're queued for a full lobby
      if (phaseRef.current === "joining") setPhase("full");
    });

    // Server promotes us from queue into an active slot
    socket.on("promoted-to-player", ({ slotId, color }: { slotId: number; color: string }) => {
      mySlotRef.current = slotId;
      setMyColor(color);
      setLiveScores([]);
      setGameEnding(false);
      setQueuePosition(null);
      setPhase("waiting");
    });

    socket.on("game-start", () => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setPhase("playing");
    });

    socket.on("leaderboard-update", (board: LiveScore[]) => {
      setLiveScores(board);
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

      const wasSpectating =
        phaseRef.current === "full" || phaseRef.current === "in-progress";

      if (wasSpectating) {
        // Server will either send 'promoted-to-player' (got a slot) or
        // 'queue-position' (still waiting). Just show the ending animation.
        setGameEnding(true);
        // Safety reset if server doesn't respond within 15s
        setTimeout(() => setGameEnding(false), 15_000);
      } else {
        setWinner(winner?.name ?? null);
        setPhase("game-over");
      }
    });

    return () => {
      socket.disconnect();
      if (respawnTimer.current) clearInterval(respawnTimer.current);
    };
  }, [isLoaded, user, serverState]);

  // ── Mini-leaderboard polling (Mode A only) ───────────────────────────────
  useEffect(() => {
    if (phase !== "waiting") return;

    const fetchBoard = () => {
      fetch("/api/leaderboard/weekly")
        .then(r => r.json())
        .then(({ board, myRank, myScore }) => {
          setMiniBoard(board ?? []);
          if (myRank  != null) setWeeklyRank(myRank);
          if (myScore != null) setWeeklyScore(myScore);
          setBoardCountdown(30);
        })
        .catch(() => {});
    };

    fetchBoard();
    const pollId      = setInterval(fetchBoard, 30_000);
    const countdownId = setInterval(() => setBoardCountdown(c => Math.max(0, c - 1)), 1_000);

    return () => {
      clearInterval(pollId);
      clearInterval(countdownId);
    };
  }, [phase]);

  const sendDir = useCallback((dir: string) => {
    if (phaseRef.current !== "playing") return;
    socketRef.current?.emit("player-input", { direction: dir });
  }, []);

  const retry = () => { setHealthError(null); setRetryKey(k => k + 1); };

  const retryLocation = () => setLocState("idle");

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (!isLoaded || !user || !profileReady) return <Centered><Spinner /></Centered>;

  // Location gate
  if (locState === "idle" || locState === "checking") {
    return (
      <Centered>
        <span className="text-4xl">📍</span>
        <p className="font-marker text-mm-cyan text-xl">Checking your location…</p>
        <Spinner />
      </Centered>
    );
  }

  if (locState === "denied") {
    return (
      <Centered>
        <span className="text-5xl">📍</span>
        <p className="font-marker text-mm-pink text-2xl">Location required</p>
        <Muted>Enable location access to play.</Muted>
        <a
          href="https://support.google.com/chrome/answer/142065"
          target="_blank"
          rel="noreferrer"
          className="font-boogaloo text-mm-cyan text-sm underline underline-offset-2"
        >
          How to enable location ↗
        </a>
        <button
          onClick={retryLocation}
          className="mt-2 font-boogaloo text-lg px-8 py-3 rounded-xl text-white"
          style={{ background: "#FF2D78", boxShadow: "0 0 20px rgba(255,45,120,.5)" }}
        >
          Retry
        </button>
      </Centered>
    );
  }

  if (locState === "blocked" && locInfo) {
    return (
      <Centered>
        <span className="text-5xl">📍</span>
        <p
          className="font-marker text-2xl"
          style={{ color: "#FF2D78", textShadow: "0 0 20px #FF2D7888" }}
        >
          YOU NEED TO BE AT
        </p>
        <p
          className="font-marker text-xl"
          style={{ color: "#00E5FF", textShadow: "0 0 16px #00E5FF88" }}
        >
          {locInfo.name}
        </p>
        <p className="font-boogaloo text-white/60 text-lg">Come join us in person to play!</p>
        <div
          className="px-5 py-3 rounded-2xl text-center"
          style={{ background: "rgba(255,45,120,.1)", border: "1px solid rgba(255,45,120,.3)" }}
        >
          <p className="font-boogaloo text-white/40 text-xs uppercase tracking-widest mb-1">Distance from venue</p>
          <p className="font-marker text-mm-pink text-2xl">{locInfo.distance}m</p>
          <p className="font-boogaloo text-white/25 text-xs">within {locInfo.radius}m to enter</p>
        </div>

        <button
          onClick={retryLocation}
          className="font-boogaloo text-lg px-8 py-3 rounded-xl text-white"
          style={{ background: "#FF2D78", boxShadow: "0 0 20px rgba(255,45,120,.5)" }}
        >
          Try Again
        </button>
      </Centered>
    );
  }

  const name = user.username ?? user.firstName ?? "Player";

  // Server loading states
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
        <a href={`${GAME_SERVER}/health`} target="_blank" rel="noreferrer"
           className="font-boogaloo text-mm-cyan text-sm underline underline-offset-2">
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

  if (phase === "joining") return <Centered><Spinner /><Muted>Joining…</Muted></Centered>;

  // ── LOS redirect screen — shown when today's game is Last One Standing ────
  if (dailyGame && dailyGame.gameSlug === "last-one-standing") {
    const ctrlUrl = `${dailyGame.controllerUrl}?userId=${encodeURIComponent(user.id)}&username=${encodeURIComponent(name)}&color=${encodeURIComponent(avatarConfig.color)}`;
    return (
      <Centered>
        <span className="text-5xl">🎨</span>
        <p className="font-boogaloo text-white/40 text-xs uppercase tracking-widest">Today&apos;s Game</p>
        <p
          className="font-marker text-3xl"
          style={{ color: dailyGame.gameColor, textShadow: `0 0 24px ${dailyGame.gameColor}88` }}
        >
          {dailyGame.gameName}
        </p>
        <Muted>Tap at the right moment or get eliminated!</Muted>
        <a
          href={ctrlUrl}
          className="font-marker text-xl px-10 py-4 rounded-2xl text-white transition-transform hover:scale-105 active:scale-95"
          style={{
            background: `${dailyGame.gameColor}22`,
            border:     `2px solid ${dailyGame.gameColor}`,
            boxShadow:  `0 0 30px ${dailyGame.gameColor}55`,
            color:      dailyGame.gameColor,
          }}
        >
          Join Game ▶
        </a>
      </Centered>
    );
  }

  // ── MODE A: Lobby — waiting for game to start ─────────────────────────
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-mm-bg flex flex-col items-center px-5 pt-8 pb-6">

        {/* Daily game banner */}
        {dailyGame && (
          <div
            className="w-full mb-2 px-4 py-2 rounded-xl flex items-center gap-2"
            style={{
              background: `${dailyGame.gameColor}12`,
              border:     `1px solid ${dailyGame.gameColor}44`,
            }}
          >
            <span className="font-boogaloo text-white/30 text-xs uppercase tracking-widest flex-1">Today&apos;s Game</span>
            <span className="font-marker text-sm" style={{ color: dailyGame.gameColor }}>{dailyGame.gameName}</span>
            {dailyGame.isOverride && (
              <span className="font-boogaloo text-[10px] text-yellow-400/60">⚡</span>
            )}
          </div>
        )}

        {/* Dev mode banner */}
        {locState === "dev" && (
          <div className="w-full mb-4 px-4 py-2 rounded-xl text-center"
               style={{ background: "rgba(255,214,0,.12)", border: "1px solid rgba(255,214,0,.3)" }}>
            <p className="font-boogaloo text-yellow-400 text-sm">
              Dev mode — no active location set
            </p>
          </div>
        )}

        {/* Top bar: settings + sign out */}
        <div className="w-full flex justify-between items-center mb-1">
          <button
            onClick={() => signOut({ redirectUrl: "/login" })}
            className="font-boogaloo text-xs text-white/30 hover:text-mm-pink transition-colors px-2 py-2"
          >
            Sign out
          </button>
          <Link href="/profile" className="p-2 rounded-xl opacity-40 hover:opacity-80 transition-opacity">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>

        {/* Avatar + identity */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <Link href="/profile" className="block">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width:      "9rem",
              height:     "9rem",
              background: `${myColor}18`,
              border:     `3px solid ${myColor}`,
              boxShadow:  `0 0 48px ${myColor}66`,
            }}
          >
            <PlayerAvatar config={{ ...avatarConfig, color: myColor }} size={104} />
          </div>
          </Link>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <h1 className="font-marker text-2xl text-white">{name}</h1>
            {weeklyRank != null && (
              <span
                className="font-boogaloo text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: `${myColor}22`,
                  color:      myColor,
                  border:     `1px solid ${myColor}55`,
                }}
              >
                #{weeklyRank} this week
              </span>
            )}
          </div>

          <p className="font-boogaloo text-xl" style={{ color: myColor }}>
            YOU&apos;RE IN! 🎨
          </p>
          <Muted>Waiting for host to start…</Muted>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-white/10 mb-5" />

        {/* Mini-leaderboard */}
        <div className="w-full flex-1">
          <div className="flex justify-between items-center mb-3">
            <span className="font-marker text-xs text-white/35 tracking-widest">
              THIS WEEK
            </span>
            <span className="font-boogaloo text-xs text-white/20">
              updates in {boardCountdown}s
            </span>
          </div>

          {miniBoard.length === 0 ? (
            <p className="text-center font-boogaloo text-white/25 text-sm py-4">
              No scores yet this week — be the first!
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {miniBoard.map((row, i) => {
                const isMe = row.clerk_id === user.id;
                return (
                  <div
                    key={row.clerk_id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: isMe ? `${myColor}18` : "rgba(255,255,255,.03)",
                      border:     `1px solid ${isMe ? myColor : "rgba(255,255,255,.06)"}`,
                    }}
                  >
                    <span
                      className="font-marker text-sm w-7 text-center flex-shrink-0"
                      style={{ color: i === 0 ? "#FFD600" : "rgba(255,255,255,.35)" }}
                    >
                      {i === 0 ? "👑" : `#${i + 1}`}
                    </span>
                    <span className="font-boogaloo text-white text-sm flex-1 truncate">
                      {row.username}{isMe ? " (you)" : ""}
                    </span>
                    <span
                      className="font-marker text-sm flex-shrink-0"
                      style={{ color: isMe ? myColor : "rgba(255,255,255,.5)" }}
                    >
                      {row.total_score}
                    </span>
                  </div>
                );
              })}

              {/* Show caller's entry below top 5 if they're ranked lower */}
              {weeklyRank != null && weeklyRank > 5 && (
                <>
                  <div className="text-center text-white/20 font-boogaloo text-xs py-0.5">
                    • • •
                  </div>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: `${myColor}18`,
                      border:     `1px solid ${myColor}`,
                    }}
                  >
                    <span
                      className="font-marker text-sm w-7 text-center flex-shrink-0"
                      style={{ color: myColor }}
                    >
                      #{weeklyRank}
                    </span>
                    <span className="font-boogaloo text-white text-sm flex-1 truncate">
                      {name} (you)
                    </span>
                    <span
                      className="font-marker text-sm flex-shrink-0"
                      style={{ color: myColor }}
                    >
                      {weeklyScore}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MODE C: Spectator — game full or already in progress ──────────────
  if (phase === "full" || phase === "in-progress") {
    return (
      <div className="min-h-screen bg-mm-bg flex flex-col items-center px-5 pt-10 pb-6">

        {/* Status header */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {gameEnding ? (
            <>
              <p
                className="font-marker text-3xl"
                style={{ color: "#00E5FF", textShadow: "0 0 20px #00E5FF" }}
              >
                GAME OVER!
              </p>
              <Muted>Getting you a spot…</Muted>
              <Spinner />
            </>
          ) : (
            <>
              <p
                className="font-marker text-2xl"
                style={{ color: "#FF6D00", textShadow: "0 0 16px #FF6D0066" }}
              >
                {phase === "in-progress" ? "GAME IN PROGRESS" : "LOBBY FULL"}
              </p>

              {queuePosition != null ? (
                <div className="flex flex-col items-center gap-1">
                  <p className="font-boogaloo text-white/70 text-lg">
                    You&apos;re{" "}
                    <span
                      className="font-marker text-2xl"
                      style={{ color: "#FF2D78", textShadow: "0 0 12px #FF2D7888" }}
                    >
                      #{queuePosition}
                    </span>{" "}
                    in line
                  </p>
                  {queueTotal > 1 && (
                    <p className="font-boogaloo text-white/30 text-sm">
                      {queueTotal} players waiting
                    </p>
                  )}
                </div>
              ) : (
                <Muted>
                  {phase === "full"
                    ? "All 4 spots are taken."
                    : "A game is already running."}
                </Muted>
              )}

              <p className="font-boogaloo text-white/40 text-sm">
                You&apos;ll join automatically when a spot opens.
              </p>
            </>
          )}
        </div>

        {/* Live scores */}
        {liveScores.length > 0 && !gameEnding && (
          <>
            <div className="w-full border-t border-white/10 mb-5" />
            <div className="w-full">
              <p className="font-marker text-xs text-white/35 tracking-widest mb-3">
                LIVE SCORES
              </p>
              <div className="flex flex-col gap-2">
                {liveScores.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: `${p.color}10`,
                      border:     `1px solid ${p.color}44`,
                    }}
                  >
                    <span
                      className="font-marker text-sm w-7 text-center flex-shrink-0"
                      style={{ color: i === 0 ? "#FFD600" : "rgba(255,255,255,.35)" }}
                    >
                      {i === 0 ? "👑" : `#${i + 1}`}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        background: p.color,
                        boxShadow:  `0 0 8px ${p.color}`,
                      }}
                    />
                    <span className="font-boogaloo text-white text-sm flex-1 truncate">
                      {p.name}
                    </span>
                    <span
                      className="font-marker text-sm flex-shrink-0"
                      style={{ color: p.color }}
                    >
                      {p.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Game over (active player who just finished a round) ───────────────
  if (phase === "game-over") {
    return (
      <Centered>
        <Headline color="#FF6D00">GAME OVER</Headline>
        {winnerName && (
          <p className="font-boogaloo text-white text-2xl">{winnerName} wins!</p>
        )}
        <Muted>Scan the QR code again to join the next round.</Muted>
      </Centered>
    );
  }

  // ── MODE B: Controller — game running, player active ──────────────────
  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background:       "#0d0d0d",
        touchAction:      "none",
        userSelect:       "none",
        WebkitUserSelect: "none",
      } as React.CSSProperties}
    >
      {/* HUD */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: "rgba(0,0,0,.65)", borderBottom: `2px solid ${myColor}` }}
      >
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={{ background: myColor, boxShadow: `0 0 10px ${myColor}` }}
        />
        <span className="font-marker text-lg flex-1 truncate" style={{ color: myColor }}>
          {name}
        </span>
        <span className="font-boogaloo text-white/60 text-sm flex-shrink-0">
          {pct}%
        </span>
      </div>

      {/* Joystick area */}
      <div className="flex-1 flex items-center justify-center">
        <Joystick color={myColor} onDirection={sendDir} />
      </div>

      {/* Death overlay */}
      {phase === "dead" && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
          <p
            className="font-marker text-4xl"
            style={{ color: "#FF6D00", textShadow: "0 0 20px #FF6D00" }}
          >
            SPRAYED!
          </p>
          <p className="font-boogaloo text-xl text-gray-300">
            Back in{" "}
            <span className="font-marker" style={{ color: "#FF6D00" }}>
              {respawnCount}
            </span>
            s…
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Joystick ───────────────────────────────────────────────────────────── */

const BASE_R     = 100;
const THUMB_R    = 40;
const DEAD_Z     = 18;
const MAX_TRAVEL = BASE_R - THUMB_R;

function Joystick({ color, onDirection }: { color: string; onDirection: (dir: string) => void }) {
  const baseRef             = useRef<HTMLDivElement>(null);
  const dirRef              = useRef<string | null>(null);
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
      const c    = getCenter();
      const dx   = touch.clientX - c.x;
      const dy   = touch.clientY - c.y;
      const dist = Math.hypot(dx, dy);

      const clamped = Math.min(dist, MAX_TRAVEL);
      const angle   = Math.atan2(dy, dx);
      setPos({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

      if (dist < DEAD_Z) { dirRef.current = null; return; }

      const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
      const newDir =
        deg >= 315 || deg < 45  ? "right" :
        deg >= 45  && deg < 135 ? "up"    :
        deg >= 135 && deg < 225 ? "left"  :
                                  "down";

      if (newDir !== dirRef.current) { dirRef.current = newDir; onDirection(newDir); }
    };

    const onStart  = (e: TouchEvent) => { e.preventDefault(); setActive(true);  move(e.touches[0]); };
    const onMove   = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0]); };
    const onEnd    = (e: TouchEvent) => { e.preventDefault(); setActive(false); setPos({ x: 0, y: 0 }); dirRef.current = null; };

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
      <div
        style={{
          width:         THUMB_R * 2,
          height:        THUMB_R * 2,
          borderRadius:  "50%",
          background:    color,
          boxShadow:     `0 0 24px ${color}99`,
          position:      "absolute",
          top:           "50%",
          left:          "50%",
          transform:     `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          transition:    active ? "none" : "transform 0.18s cubic-bezier(.22,1,.36,1)",
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
