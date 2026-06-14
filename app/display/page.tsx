"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
import { GraffitiAnimation } from "@/components/GraffitiAnimation";
import type { AvatarConfig, WeeklyLeaderboardRow, WeeklyChampion } from "@/lib/types";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? "https://mix-master-gray.vercel.app";
const JOIN_URL    = `${APP_URL}/join`;
const QR_SRC      = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=111111&bgcolor=ffffff&data=${encodeURIComponent(JOIN_URL)}`;

type LobbyPlayer = {
    slotId:       number;
    userId:       string;
    username:     string;
    avatarUrl:    string | null;
    avatarConfig: AvatarConfig | null;
    color:        string;
};

type BoardRow = WeeklyLeaderboardRow & { avatar_config: AvatarConfig | null };

type DisplayData = {
    board:    BoardRow[];
    champion: WeeklyChampion | null;
};

type Phase = "lobby" | "game";

function weekCountdown(): string {
    const now = new Date();
    const dow = now.getUTCDay();
    const daysUntilMonday = ((8 - dow) % 7) || 7;
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
    const diffMs = nextMonday.getTime() - now.getTime();
    if (diffMs <= 0) return "0d 0h 0m";
    const totalMins = Math.floor(diffMs / 60_000);
    const d = Math.floor(totalMins / (60 * 24));
    const h = Math.floor((totalMins % (60 * 24)) / 60);
    const m = totalMins % 60;
    return `${d}d ${h}h ${m}m`;
}

function FireworksLayer() {
    const bursts = [
        { left: "17%", top: "18%", color: "#FF2D78", delay: "0ms" },
        { left: "82%", top: "20%", color: "#00E5FF", delay: "260ms" },
        { left: "28%", top: "70%", color: "#76FF03", delay: "520ms" },
        { left: "72%", top: "72%", color: "#FF6D00", delay: "760ms" },
        { left: "50%", top: "12%", color: "#FFD600", delay: "1040ms" },
    ];
    const rays = Array.from({ length: 14 }, (_, i) => i);

    return (
        <>
            {bursts.map((burst, burstIndex) => (
                <div
                    key={`${burst.left}-${burst.top}`}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                        left: burst.left,
                        top: burst.top,
                        background: burst.color,
                        boxShadow: `0 0 18px ${burst.color}`,
                        animation: `firework-burst 1.7s ease-out ${burst.delay} infinite`,
                    }}
                >
                    {rays.map((ray) => {
                        const angle = (Math.PI * 2 * ray) / rays.length;
                        const dist = 62 + ((ray + burstIndex) % 4) * 12;
                        return (
                            <span
                                key={ray}
                                className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
                                style={{
                                    background: burst.color,
                                    boxShadow: `0 0 12px ${burst.color}`,
                                    transform: "translate(-50%, -50%)",
                                    ['--tx' as string]: `${Math.cos(angle) * dist}px`,
                                    ['--ty' as string]: `${Math.sin(angle) * dist}px`,
                                    animation: `firework-dot 1.7s ease-out ${burst.delay} infinite`,
                                }}
                            />
                        );
                    })}
                </div>
            ))}
        </>
    );
}


export default function DisplayPage() {
    const [phase,           setPhase]           = useState<Phase>("lobby");
    const [players,         setPlayers]         = useState<LobbyPlayer[]>([]);
    const [displayData,     setDisplayData]     = useState<DisplayData>({ board: [], champion: null });
    const [countdown,       setCountdown]       = useState(weekCountdown());
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    // Track match results natively on the platform layer over the iframe
    const [endGameData,     setEndGameData]     = useState<{ winner: any; scores: any[] } | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const rowRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
    const oldTops   = useRef<Map<string, number>>(new Map());

    const isCollapsed = phase === "game" && !sidebarExpanded;

    /* ── FLIP rank animation ─────────────────────────────────────────── */
    useLayoutEffect(() => {
        rowRefs.current.forEach((el, id) => {
            const oldTop = oldTops.current.get(id);
            if (oldTop == null) return;
            const newTop = el.getBoundingClientRect().top;
            const delta  = oldTop - newTop;
            if (delta === 0) return;
            el.style.transition = "none";
            el.style.transform  = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
                el.style.transition = "transform 0.5s ease";
                el.style.transform  = "translateY(0)";
            });
        });
    }, [displayData]);

    /* ── Socket.io ───────────────────────────────────────────────────── */
    useEffect(() => {
        const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
        socketRef.current = socket;
        socket.emit("display-join");
        socket.on("lobby-update", (lobby: LobbyPlayer[]) => setPlayers(lobby));

        socket.on("game-countdown", () => {
            setEndGameData(null);
            setPhase("game");
        });

        socket.on("game-start", () => {
            setEndGameData(null);
            setPhase("game");
        });

        socket.on("game-end", (data: { winner: any; scores: any[] }) => {
            setEndGameData(data);
            // Let the results breathe, then reset the game server back into lobby so the TV START GAME button works again.
            const resetDelay = window.setTimeout(() => {
                socket.emit("play-again");
                setPhase("lobby");
                setEndGameData(null);
                setSidebarExpanded(false);
            }, 8000);
            socket.once("game-start", () => window.clearTimeout(resetDelay));
        });
        return () => { socket.disconnect(); };
    }, []);

    /* ── Leaderboard polling ─────────────────────────────────────────── */
    useEffect(() => {
        const fetchBoard = async () => {
            try {
                const res = await fetch("/api/leaderboard/display");
                if (!res.ok) return;
                const data: DisplayData = await res.json();
                const snapshot = new Map<string, number>();
                rowRefs.current.forEach((el, id) => snapshot.set(id, el.getBoundingClientRect().top));
                oldTops.current = snapshot;
                setDisplayData(data);
            } catch { /* silently skip */ }
        };
        fetchBoard();
        const id = setInterval(fetchBoard, 30_000);
        return () => clearInterval(id);
    }, []);

    /* ── Week countdown ticker ───────────────────────────────────────── */
    useEffect(() => {
        const id = setInterval(() => setCountdown(weekCountdown()), 60_000);
        return () => clearInterval(id);
    }, []);

    /* ── Derived ─────────────────────────────────────────────────────── */
    const activeUserIds = new Set(players.map(p => p.userId));
    const leaderColor   = displayData.board[0]?.avatar_config?.color ?? "#FF2D78";
    const topPlayer     = displayData.board[0] ?? null;

    /* ── Sidebar: full leaderboard view ─────────────────────────────── */
    const sidebarFull = (
        <div className={`flex-col h-full w-[280px] overflow-hidden ${isCollapsed ? "hidden" : "flex"}`}>
            <div className="px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
                <h2
                    className="font-marker text-xl text-center"
                    style={{ color: leaderColor, textShadow: `0 0 20px ${leaderColor}88` }}
                >
                    KINGS OF THE WALL 👑
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {displayData.board.map((row, i) => {
                    const isActive = activeUserIds.has(row.clerk_id);
                    const cfg      = row.avatar_config ?? DEFAULT_AVATAR;
                    return (
                        <div
                            key={row.player_id}
                            ref={el => {
                                if (el) rowRefs.current.set(row.player_id, el);
                                else     rowRefs.current.delete(row.player_id);
                            }}
                            className="flex items-center gap-3 rounded-xl px-3 py-2"
                            style={{
                                background: isActive ? `${cfg.color}18` : "transparent",
                                border:     `1px solid ${isActive ? cfg.color : "rgba(255,255,255,0.06)"}`,
                                boxShadow:  isActive ? `0 0 14px ${cfg.color}44` : "none",
                            }}
                        >
              <span className="font-marker text-sm w-5 text-center shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>
                {i + 1}
              </span>
                            <PlayerAvatar config={{ ...cfg, color: cfg.color }} size={32} />
                            <span className="font-boogaloo text-white flex-1 truncate text-sm">{row.username}</span>
                            <span className="font-marker text-sm shrink-0" style={{ color: cfg.color }}>{row.total_score}</span>
                        </div>
                    );
                })}
                {displayData.board.length === 0 && (
                    <p className="font-boogaloo text-white/25 text-sm text-center pt-4">No scores yet this week</p>
                )}
            </div>

            <div className="px-6 py-3 border-t border-white/10 text-center shrink-0">
                <p className="font-boogaloo text-white/30 text-xs uppercase tracking-widest">Week resets in</p>
                <p className="font-marker text-white/60 text-lg">{countdown}</p>
            </div>

            {displayData.champion?.players && (
                <div className="px-6 py-4 border-t border-white/10 flex flex-col items-center gap-2 shrink-0">
                    <p className="font-boogaloo text-yellow-400/70 text-xs uppercase tracking-widest">Last Week&apos;s Champion</p>
                    <PlayerAvatar
                        config={{
                            ...(displayData.champion.players.avatar_config ?? DEFAULT_AVATAR),
                            color: displayData.champion.players.avatar_config?.color ?? "#FFD600",
                        }}
                        size={48}
                    />
                    <p className="font-marker text-white/90 text-sm">{displayData.champion.players.username}</p>
                    <p className="font-boogaloo text-yellow-400/50 text-xs">Mix Master of the Week 👑</p>
                </div>
            )}
        </div>
    );

    /* ── Sidebar: collapsed view ─────────────────────────────────────── */
    const sidebarCompact = isCollapsed && (
        <div className="flex flex-col items-center gap-2 py-5 w-20 h-full">
            <span className="text-xl leading-none">👑</span>
            {topPlayer && (
                <p
                    className="font-marker text-[9px] text-center px-1 leading-tight w-full truncate"
                    style={{ color: topPlayer.avatar_config?.color ?? leaderColor }}
                >
                    {topPlayer.username.slice(0, 8)}
                </p>
            )}
            <div className="flex flex-col gap-1.5 items-center w-full mt-1">
                {displayData.board.slice(0, 8).map((row, i) => {
                    const dotColor = row.avatar_config?.color ?? "#ffffff";
                    const isActive = activeUserIds.has(row.clerk_id);
                    return (
                        <div key={row.player_id} className="flex items-center gap-1 px-3 w-full">
                            <span className="font-marker text-[10px] text-white/30 w-3 text-right shrink-0">{i + 1}</span>
                            <div
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{
                                    background: dotColor,
                                    boxShadow:  isActive ? `0 0 6px ${dotColor}` : "none",
                                    opacity:    isActive ? 1 : 0.5,
                                }}
                            />
                        </div>
                    );
                })}
            </div>
            <p className="mt-auto font-boogaloo text-white/15 text-[9px]">hover</p>
        </div>
    );

    /* ── Layout ──────────────────────────────────────────────────────── */
    return (
        <div className="flex h-screen overflow-hidden bg-mm-bg">
            <style>{`
                @keyframes result-card-pop {
                    0% { opacity: 0; transform: translateY(28px) scale(0.94); filter: blur(8px); }
                    65% { opacity: 1; transform: translateY(-3px) scale(1.015); filter: blur(0); }
                    100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
                }
                @keyframes result-row-in {
                    0% { opacity: 0; transform: translateX(-18px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes result-bar-grow {
                    0% { transform: scaleX(0); }
                    100% { transform: scaleX(1); }
                }
                @keyframes firework-burst {
                    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
                    12% { opacity: 1; }
                    72% { opacity: .95; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
                }
                @keyframes firework-dot {
                    0% { transform: translate(0, 0) scale(1); opacity: 1; }
                    100% { transform: translate(var(--tx), var(--ty)) scale(0.15); opacity: 0; }
                }
                @keyframes winner-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.035); }
                }
            `}</style>

            {/* Left: game iframe or lobby */}
            <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                {phase === "game" ? (
                    <div className="absolute inset-0 w-full h-full">
                        <iframe
                            src={`${GAME_SERVER}/display?embed=1`}
                            className="w-full h-full border-0"
                            title="Mix Master"
                            allow="fullscreen"
                        />

                        {/* Game Over overlay built natively on the platform tier */}
                        {endGameData && (() => {
                            const topScore = endGameData.scores[0] ?? null;
                            return (
                                <div className="absolute inset-0 z-50 bg-black/88 flex items-center justify-center animate-fade-in overflow-hidden">
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute inset-0 opacity-45" style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.08), transparent 50%)" }} />
                                        <FireworksLayer />
                                        <div className="absolute top-[12%] left-[15%] w-28 h-28 rounded-full blur-3xl opacity-35" style={{ background: "#FF2D78" }} />
                                        <div className="absolute top-[18%] right-[18%] w-36 h-36 rounded-full blur-3xl opacity-30" style={{ background: "#00E5FF" }} />
                                        <div className="absolute bottom-[20%] left-[22%] w-32 h-32 rounded-full blur-3xl opacity-25" style={{ background: "#76FF03" }} />
                                        <div className="absolute bottom-[14%] right-[20%] w-32 h-32 rounded-full blur-3xl opacity-25" style={{ background: "#FF6D00" }} />
                                    </div>

                                    <div
                                        className="relative w-full max-w-3xl mx-8 rounded-[34px] border border-white/10 bg-[#0d0d0d]/92 shadow-[0_0_70px_rgba(0,0,0,0.55)] px-10 py-10 flex flex-col items-center gap-7"
                                        style={{ animation: "result-card-pop 680ms cubic-bezier(.16,1,.3,1) both" }}
                                    >
                                        <div className="absolute -inset-px rounded-[34px] pointer-events-none opacity-70" style={{ background: "linear-gradient(135deg, rgba(255,45,120,.5), transparent 28%, rgba(0,229,255,.35) 68%, rgba(118,255,3,.35))", mask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)", WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)", padding: 1, WebkitMaskComposite: "xor", maskComposite: "exclude" }} />

                                        <div className="text-center">
                                            <p className="font-marker text-7xl text-[#FF6D00] tracking-wider drop-shadow-[0_0_25px_#FF6D00]">
                                                GAME OVER
                                            </p>
                                            <div
                                                className="inline-flex mt-4 px-8 py-3 rounded-full border-2 font-boogaloo text-4xl"
                                                style={{
                                                    color: endGameData.winner?.color ?? "#fff",
                                                    borderColor: `${endGameData.winner?.color ?? "#fff"}88`,
                                                    background: `${endGameData.winner?.color ?? "#ffffff"}14`,
                                                    boxShadow: `0 0 28px ${endGameData.winner?.color ?? "#ffffff"}33`,
                                                    animation: "winner-pulse 1.4s ease-in-out infinite",
                                                }}
                                            >
                                                {endGameData.winner ? `${endGameData.winner.name} won the wall!` : "It's a draw!"}
                                            </div>
                                        </div>

                                        {topScore && (
                                            <div className="text-center rounded-[30px] px-14 py-7 border-2" style={{ borderColor: `${topScore.color}88`, background: `${topScore.color}12`, boxShadow: `0 0 32px ${topScore.color}33` }}>
                                                <p className="font-marker text-8xl leading-none" style={{ color: topScore.color, textShadow: `0 0 28px ${topScore.color}66` }}>
                                                    {topScore.pct}%
                                                </p>
                                                <p className="font-boogaloo text-white/80 text-2xl mt-2 tracking-wide">
                                                    AREA CAPTURED
                                                </p>
                                            </div>
                                        )}

                                        <div className="w-full max-w-xl flex flex-col gap-3">
                                            {endGameData.scores.map((p, index) => {
                                                const pct = Math.max(0, Math.min(100, Number(p.pct) || 0));
                                                return (
                                                    <div
                                                        key={p.id}
                                                        className="relative overflow-hidden px-5 py-4 rounded-2xl bg-white/5 border border-white/10"
                                                        style={{ animation: `result-row-in 420ms ease-out ${index * 90 + 120}ms both` }}
                                                    >
                                                        <div className="absolute inset-y-0 left-0 opacity-18 origin-left" style={{ width: `${pct}%`, background: p.color, animation: `result-bar-grow 900ms ease-out ${index * 110 + 260}ms both` }} />
                                                        <div className="relative flex justify-between items-center gap-4">
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <span className="font-marker text-xl w-10 text-center" style={{ color: index === 0 ? "#FFD600" : "rgba(255,255,255,0.45)" }}>
                                                                    {index === 0 ? "👑" : `#${index + 1}`}
                                                                </span>
                                                                <span className="font-boogaloo text-2xl truncate" style={{ color: p.color }}>{p.name}</span>
                                                            </div>
                                                            <span className="font-marker text-3xl shrink-0" style={{ color: p.color }}>{p.pct}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="font-boogaloo text-white/45 text-lg text-center">
                                            Returning to the lobby for the next round…
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}                    </div>
                ) : (
                    <>
                    <GraffitiAnimation visible={players.length === 0} />
                    <div
                        className="relative flex flex-col items-center gap-8 px-8 py-10 w-full"
                        style={{ overflow: "visible", textAlign: "center", zIndex: 1 }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo.png"
                            alt="Mix Master"
                            style={{
                                height:    "160px",
                                width:     "auto",
                                display:   "block",
                                margin:    "0 auto 20px auto",
                                objectFit: "contain",
                                filter:    "drop-shadow(0 0 20px rgba(255,45,120,0.6))",
                            }}
                        />

                        <div className="flex flex-col items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={QR_SRC}
                                alt="Scan to join"
                                width={200}
                                height={200}
                                className="rounded-2xl border-[5px] border-white shadow-2xl"
                            />
                            <p className="font-boogaloo text-white/55 text-lg">
                                First time? Scan to install 📲
                            </p>
                            <p className="font-boogaloo text-white/40 text-lg">
                                Already have it? Scan to join 🎮
                            </p>
                        </div>

                        {players.length > 0 && (
                            <div className="flex gap-4 flex-wrap justify-center">
                                {players.map(p => (
                                    <div
                                        key={p.slotId}
                                        className="flex flex-col items-center gap-2 bg-mm-surface rounded-2xl px-5 py-4"
                                        style={{ border: `2px solid ${p.color}`, boxShadow: `0 0 20px ${p.color}44` }}
                                    >
                                        <div
                                            className="rounded-full flex items-center justify-center"
                                            style={{
                                                width: "5rem", height: "5rem",
                                                background: `${p.color}18`,
                                                border: `2px solid ${p.color}`,
                                                boxShadow: `0 0 16px ${p.color}44`,
                                            }}
                                        >
                                            <PlayerAvatar config={{ ...(p.avatarConfig ?? DEFAULT_AVATAR), color: p.color }} size={60} />
                                        </div>
                                        <span className="font-marker text-sm" style={{ color: p.color }}>{p.username}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {players.length === 0 && (
                            <p className="font-boogaloo text-white/25 text-lg">Waiting for players to scan…</p>
                        )}
                        {players.length === 1 && (
                            <p className="font-boogaloo text-white/35 text-lg">1 player connected — need at least 1 more…</p>
                        )}
                        {players.length >= 2 && (
                            <button
                                onClick={() => socketRef.current?.emit("game-start")}
                                className="font-marker text-2xl px-12 py-4 rounded-2xl text-white transition-transform hover:scale-105 active:scale-95"
                                style={{ background: "#FF2D78", boxShadow: "0 0 40px rgba(255,45,120,.6)" }}
                            >
                                START GAME
                            </button>
                        )}
                    </div>
                    </>
                )}
            </div>

            {/* Right: leaderboard sidebar */}
            <aside
                onMouseEnter={() => { if (phase === "game") setSidebarExpanded(true); }}
                onMouseLeave={() => setSidebarExpanded(false)}
                className={[
                    "flex flex-col bg-mm-surface h-screen border-l border-white/10 shrink-0",
                    "transition-[width] duration-300 ease-in-out overflow-hidden",
                    isCollapsed ? "w-20" : "w-[280px]",
                ].join(" ")}
            >
                {sidebarCompact}
                {sidebarFull}
            </aside>

        </div>
    );
}