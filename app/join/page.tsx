"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";
import { io, Socket } from "socket.io-client";
import { InstallBanner } from "@/components/InstallBanner";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;

type ServerState = "checking" | "starting" | "failed" | "ready";
type Phase       = "joining" | "waiting" | "playing" | "dead" | "full" | "in-progress" | "game-over";

type MiniRow   = { rank: number; clerk_id: string; username: string; total_score: number };
type LiveScore = { id: number; rank: number; name: string; color: string; pct: string };
type FinalResults = { winner: { id?: number; name: string; color?: string } | null; scores: LiveScore[] };

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
  const [myColor,      setMyColor]    = useState("#FF2D78");
  const [gameColor,    setGameColor]  = useState("#FF2D78");
  const [respawnCount, setRespawn] = useState(0);
  const [rank,         setRank]    = useState<number | null>(null);
  const [pct,          setPct]     = useState("0");
  const [winnerName,   setWinner]  = useState<string | null>(null);
  const [gameResults,  setGameResults] = useState<FinalResults | null>(null);

  // ── Mode A: lobby mini-leaderboard ───────────────────────────────────────
  const [miniBoard,      setMiniBoard]      = useState<MiniRow[]>([]);
  const [boardCountdown, setBoardCountdown] = useState(30);

  // ── Mode C: spectator / queue ────────────────────────────────────────────
  const [liveScores,     setLiveScores]     = useState<LiveScore[]>([]);
  const [gameEnding,     setGameEnding]     = useState(false);
  const [queuePosition,  setQueuePosition]  = useState<number | null>(null);
  const [queueTotal,     setQueueTotal]     = useState(0);

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

    fetch(`/api/profile/me?ts=${Date.now()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(async ({ player, weeklyRank: wr, weeklyScore: ws }) => {
        if (!player?.avatar_config) {
          // No avatar saved yet — write DEFAULT_AVATAR so every player always has a color
          const name = (player?.username || user?.username || user?.firstName || "Player") as string;
          await fetch("/api/profile/save", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username: name, avatar_config: DEFAULT_AVATAR }),
          }).catch(() => {});
          setAvatarConfig(DEFAULT_AVATAR);
          setWeeklyRank(wr ?? null);
          setWeeklyScore(ws ?? 0);
          setProfileReady(true);
          return;
        }
        setAvatarConfig(player.avatar_config as AvatarConfig);
        setWeeklyRank(wr ?? null);
        setWeeklyScore(ws ?? 0);
        setProfileReady(true);
      })
      .catch(() => setProfileReady(true));
  }, [isLoaded, user, router]);

  // Phase 1: health check
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

  // ── Phase 2: Socket.io ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user || serverState !== "ready") return;

    // Safety net — if no color is set, send to profile before joining
    if (!avatarConfigRef.current.color) {
      console.warn('[join] avatar color missing — redirecting to /profile');
      router.replace("/profile");
      return;
    }

    const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    const emitJoin = () => {
      const cfg = avatarConfigRef.current;
      console.log('[join] sending color:', cfg.color);
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
      setWinner(null);
      setGameResults(null);
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
      setWinner(null);
      setGameResults(null);
      setQueuePosition(null);
      setPhase("waiting");
    });

    // Slot color from server — only drives the D-pad; avatar keeps avatarConfig.color
    socket.on("color-assigned", ({ color }: { color: string }) => {
      setGameColor(color);
    });

    socket.on("game-start", () => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setWinner(null);
      setGameResults(null);
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

    socket.on("game-end", ({ winner, scores }: FinalResults) => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);

      const results: FinalResults = { winner, scores: scores ?? [] };
      const wasSpectating =
        phaseRef.current === "full" || phaseRef.current === "in-progress";

      setWinner(winner?.name ?? null);
      setGameResults(results);

      if (wasSpectating) {
        setGameEnding(true);
        setTimeout(() => setGameEnding(false), 15_000);
      } else {
        setPhase("game-over");
      }
    });

    socket.on("lobby-reset", () => {
      if (respawnTimer.current) clearInterval(respawnTimer.current);
      setGameEnding(false);
      setWinner(null);
      setGameResults(null);
      setLiveScores([]);
      setRank(null);
      setPct("0");
      if (mySlotRef.current != null) setPhase("waiting");
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

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (!isLoaded || !user || !profileReady) return <Centered><Spinner /></Centered>;

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

  // ── MODE A: Lobby — waiting for game to start ─────────────────────────
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-mm-bg flex flex-col items-center px-5 pt-8 pb-6">
        <InstallBanner />

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
              background: `${avatarConfig.color}18`,
              border:     `3px solid ${avatarConfig.color}`,
              boxShadow:  `0 0 48px ${avatarConfig.color}66`,
            }}
          >
            <PlayerAvatar config={avatarConfig} size={104} />
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
        <InstallBanner />

        {/* Status header */}
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {gameEnding && gameResults ? (
            <ResultsCard
              winner={gameResults.winner}
              scores={gameResults.scores}
              mySlot={mySlotRef.current}
              title="ROUND OVER"
              subtitle="Getting you ready for the next round…"
              footer={queuePosition != null
                ? `Still in queue — you’re #${queuePosition}${queueTotal > 1 ? ` of ${queueTotal}` : ""}.`
                : "The room is updating for the next round."}
            />
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
      <div className="min-h-screen bg-mm-bg flex flex-col items-center justify-center px-5 py-8">
        <InstallBanner />
        <ResultsCard
          winner={gameResults?.winner ?? (winnerName ? { name: winnerName } : null)}
          scores={gameResults?.scores ?? []}
          mySlot={mySlotRef.current}
          title="MATCH OVER"
          subtitle="Final results"
          footer="Stay connected — the TV will start the next round."
        />
      </div>
    );
  }

  // ── MODE B: Controller — game running, player active ──────────────────
  console.log('[join] rendering controller with DPad');
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

      {/* D-pad area */}
      <div className="flex-1 flex items-center justify-center">
        <DPad color={gameColor} onDirection={sendDir} />
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

function ResultsCard({
  winner,
  scores,
  mySlot,
  title,
  subtitle,
  footer,
}: {
  winner: { id?: number; name: string; color?: string } | null;
  scores: LiveScore[];
  mySlot: number | null;
  title: string;
  subtitle?: string;
  footer?: string;
}) {
  const topScore = scores[0] ?? null;
  const myRow = mySlot != null ? scores.find((p) => p.id === mySlot) ?? null : null;
  const accent = winner?.color ?? topScore?.color ?? "#FF2D78";
  const confetti = ["#FF2D78", "#00E5FF", "#76FF03", "#FF6D00", "#FFD600"];

  return (
    <div className="w-full max-w-md relative">
      <style>{`
        @keyframes phone-result-pop {
          0% { opacity: 0; transform: translateY(18px) scale(.96); filter: blur(6px); }
          70% { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes phone-confetti-fall {
          0% { transform: translateY(-18px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(34px) rotate(180deg); opacity: 0; }
        }
        @keyframes phone-score-row {
          0% { opacity: 0; transform: translateX(-14px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes phone-score-fill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes phone-locked-pulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>

      {confetti.map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="absolute top-1 rounded-sm pointer-events-none"
          style={{
            left: `${12 + i * 19}%`,
            width: 8,
            height: i % 2 === 0 ? 14 : 8,
            background: color,
            boxShadow: `0 0 10px ${color}`,
            animation: `phone-confetti-fall 1.8s ease-in-out ${i * 130}ms infinite`,
            zIndex: 1,
          }}
        />
      ))}

      <div
        className="relative overflow-hidden rounded-[30px] border bg-mm-surface/95 px-5 py-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]"
        style={{
          borderColor: `${accent}55`,
          boxShadow: `0 0 36px ${accent}22, 0 0 40px rgba(0,0,0,.35)`,
          animation: "phone-result-pop 560ms cubic-bezier(.16,1,.3,1) both",
        }}
      >
        <div className="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl opacity-25" style={{ background: accent }} />

        <div className="relative text-center mb-5">
          <p className="font-marker text-4xl text-mm-orange" style={{ textShadow: "0 0 18px rgba(255,109,0,0.45)" }}>
            {title}
          </p>
          {winner && (
            <div
              className="inline-flex mt-3 px-5 py-2 rounded-full border font-boogaloo text-2xl"
              style={{ color: accent, borderColor: `${accent}77`, background: `${accent}12` }}
            >
              {winner.name} won the wall!
            </div>
          )}
          {subtitle && <p className="font-boogaloo text-white/45 text-sm mt-2">{subtitle}</p>}
        </div>

        {topScore ? (
          <div
            className="relative rounded-[24px] px-5 py-5 text-center mb-5 overflow-hidden"
            style={{
              background: `${topScore.color}12`,
              border: `2px solid ${topScore.color}66`,
              boxShadow: `0 0 24px ${topScore.color}22`,
            }}
          >
            <div className="absolute inset-y-0 left-0 opacity-15 origin-left" style={{ width: `${Math.max(0, Math.min(100, Number(topScore.pct) || 0))}%`, background: topScore.color, animation: "phone-score-fill 850ms ease-out 160ms both" }} />
            <div className="relative">
              <p className="font-marker text-6xl leading-none" style={{ color: topScore.color, textShadow: `0 0 18px ${topScore.color}66` }}>
                {topScore.pct}%
              </p>
              <p className="font-boogaloo text-white/80 text-lg mt-2">AREA CAPTURED</p>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] px-5 py-8 text-center mb-5 border border-white/10 bg-black/20">
            <Spinner />
            <p className="font-boogaloo text-white/45 text-sm mt-3">Waiting for final scores…</p>
          </div>
        )}

        {myRow && (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 mb-4">
            <p className="font-marker text-xs text-white/35 tracking-widest mb-2">YOUR RESULT</p>
            <div className="flex items-center justify-between gap-3">
              <span className="font-boogaloo text-lg text-white truncate">
                #{myRow.rank} • {myRow.name}
              </span>
              <span className="font-marker text-2xl shrink-0" style={{ color: myRow.color }}>{myRow.pct}%</span>
            </div>
          </div>
        )}

        {scores.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-marker text-xs text-white/35 tracking-widest mb-1">FINAL RANKING</p>
            {scores.map((p, index) => {
              const pct = Math.max(0, Math.min(100, Number(p.pct) || 0));
              return (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-2xl px-3 py-3"
                  style={{
                    background: `${p.color}10`,
                    border: `1px solid ${p.color}44`,
                    animation: `phone-score-row 360ms ease-out ${index * 80 + 120}ms both`,
                  }}
                >
                  <div className="absolute inset-y-0 left-0 opacity-16 origin-left" style={{ width: `${pct}%`, background: p.color, animation: `phone-score-fill 780ms ease-out ${index * 90 + 220}ms both` }} />
                  <div className="relative flex items-center gap-3">
                    <span
                      className="font-marker text-sm w-7 text-center flex-shrink-0"
                      style={{ color: index === 0 ? "#FFD600" : "rgba(255,255,255,.4)" }}
                    >
                      {index === 0 ? "👑" : `#${index + 1}`}
                    </span>
                    <span className="font-boogaloo text-white text-base flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="font-marker text-lg flex-shrink-0" style={{ color: p.color }}>
                      {p.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center">
          <p className="font-marker text-xs tracking-widest" style={{ color: accent, animation: "phone-locked-pulse 1.4s ease-in-out infinite" }}>
            CONTROLLER LOCKED
          </p>
          {footer && (
            <p className="font-boogaloo text-white/45 text-sm mt-1">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── D-pad ──────────────────────────────────────────────────────────────── */

function DPad({ color, onDirection }: { color: string; onDirection: (dir: string) => void }) {
  const btn = (dir: string, label: string) => (
    <button
      key={dir}
      onTouchStart={(e) => { e.preventDefault(); onDirection(dir); }}
      style={{
        width:            100,
        height:           100,
        background:       color,
        border:           `2px solid ${color}`,
        borderRadius:     18,
        fontSize:         38,
        color:            "#fff",
        boxShadow:        `0 0 10px ${color}`,
        touchAction:      "manipulation",
        cursor:           "pointer",
        userSelect:       "none",
        WebkitUserSelect: "none",
        display:          "flex",
        alignItems:       "center",
        justifyContent:   "center",
      } as React.CSSProperties}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: "repeat(3, 100px)",
        gridTemplateRows:    "repeat(3, 100px)",
        gap:                 12,
      }}
    >
      <span />{btn("up",    "▲")}<span />
      {btn("left", "◄")}<span />{btn("right", "►")}
      <span />{btn("down",  "▼")}<span />
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
