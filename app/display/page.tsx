"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
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

type Phase    = "lobby" | "game";
type AdminLoc = { name: string; lat: number; lon: number; radius_m: number; is_active: boolean } | null;

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

export default function DisplayPage() {
    const [phase,           setPhase]           = useState<Phase>("lobby");
    const [players,         setPlayers]         = useState<LobbyPlayer[]>([]);
    const [displayData,     setDisplayData]     = useState<DisplayData>({ board: [], champion: null });
    const [countdown,       setCountdown]       = useState(weekCountdown());
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    // Track match results natively on the platform layer over the iframe
    const [endGameData,     setEndGameData]     = useState<{ winner: any; scores: any[] } | null>(null);

    // Admin panel
    const [showAdmin,     setShowAdmin]     = useState(false);
    const [adminLoc,      setAdminLoc]      = useState<AdminLoc>(null);
    const [adminName,     setAdminName]     = useState("Mix Master Club");
    const [adminRadius,   setAdminRadius]   = useState(500);
    const [adminLat,      setAdminLat]      = useState<number | null>(null);
    const [adminLng,      setAdminLng]      = useState<number | null>(null);
    const [adminStatus,   setAdminStatus]   = useState<string | null>(null);
    const [adminSaving,   setAdminSaving]   = useState(false);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [latStr,        setLatStr]        = useState("");
    const [lngStr,        setLngStr]        = useState("");
    const [addrInput,     setAddrInput]     = useState("");
    const [addrSearching, setAddrSearching] = useState(false);

    const socketRef     = useRef<Socket | null>(null);
    const rowRefs       = useRef<Map<string, HTMLDivElement>>(new Map());
    const oldTops       = useRef<Map<string, number>>(new Map());
    const mapRef        = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leafletMapRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markerRef     = useRef<any>(null);

    const isCollapsed = phase === "game" && !sidebarExpanded;

    const updateLocation = (lat: number, lng: number) => {
        setAdminLat(lat);
        setAdminLng(lng);
        setLatStr(lat.toFixed(6));
        setLngStr(lng.toFixed(6));
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        if (leafletMapRef.current) leafletMapRef.current.setView([lat, lng], 15);
    };

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
            // Revert back to lobby view at 7 seconds so room allocations persist in the layout context
            setTimeout(() => {
                setPhase("lobby");
                setEndGameData(null);
                setSidebarExpanded(false);
            }, 7000);
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

    /* ── Admin: detect ?admin=true, verify auth, then show panel ──────── */
    useEffect(() => {
        const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
        if (!isAdmin) return;

        fetch("/api/location/status")
            .then(async r => {
                if (!r.ok) return;
                const { location } = await r.json();
                setShowAdmin(true);
                if (!location) return;
                setAdminLoc(location);
                setAdminName(location.name);
                setAdminRadius(location.radius_m);
                setAdminLat(location.lat);
                setAdminLng(location.lon);
                setLatStr(location.lat.toFixed(6));
                setLngStr(location.lon.toFixed(6));
                if (markerRef.current && leafletMapRef.current) {
                    markerRef.current.setLatLng([location.lat, location.lon]);
                    leafletMapRef.current.setView([location.lat, location.lon], 15);
                }
            })
            .catch(() => {});
    }, []);

    /* ── Admin: load Leaflet CSS + JS from CDN ───────────────────────── */
    useEffect(() => {
        if (!showAdmin) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).L) { setLeafletLoaded(true); return; }
        if (!document.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement("link");
            link.rel  = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);
        }
        if (!document.querySelector('script[src*="leaflet"]')) {
            const script   = document.createElement("script");
            script.src     = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.onload  = () => setLeafletLoaded(true);
            document.head.appendChild(script);
        }
    }, [showAdmin]);

    /* ── Admin: init Leaflet map once loaded + container rendered ─────── */
    useEffect(() => {
        if (!leafletLoaded || !showAdmin || !mapRef.current || leafletMapRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L          = (window as any).L;
        const defaultLat = adminLat ?? 32.0853;
        const defaultLng = adminLng ?? 34.7818;

        const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
            const pos = marker.getLatLng();
            setAdminLat(pos.lat);
            setAdminLng(pos.lng);
            setLatStr(pos.lat.toFixed(6));
            setLngStr(pos.lng.toFixed(6));
        });

        leafletMapRef.current = map;
        markerRef.current     = marker;

        if (!latStr) setLatStr(defaultLat.toFixed(6));
        if (!lngStr) setLngStr(defaultLng.toFixed(6));

        setTimeout(() => map.invalidateSize(), 120);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leafletLoaded, showAdmin]);

    /* ── Admin actions ───────────────────────────────────────────────── */
    const adminGPS = () => {
        if (!navigator.geolocation) { setAdminStatus("GPS not available"); return; }
        setAdminStatus("Getting location…");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                updateLocation(pos.coords.latitude, pos.coords.longitude);
                setAdminStatus("Location captured");
            },
            () => setAdminStatus("GPS denied — check browser permissions"),
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        );
    };

    const searchAddress = async () => {
        if (!addrInput.trim()) return;
        setAddrSearching(true);
        setAdminStatus(null);
        try {
            const res  = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addrInput)}&format=json&limit=1`,
                { headers: { "Accept-Language": "en" } },
            );
            const data = await res.json();
            if (data[0]) {
                updateLocation(parseFloat(data[0].lat), parseFloat(data[0].lon));
                setAdminStatus(`Found: ${(data[0].display_name as string).split(",").slice(0, 2).join(", ")}`);
            } else {
                setAdminStatus("Address not found");
            }
        } catch {
            setAdminStatus("Search failed");
        } finally {
            setAddrSearching(false);
        }
    };

    const adminSave = async () => {
        if (adminLat == null || adminLng == null) { setAdminStatus("Set a location first"); return; }
        setAdminSaving(true);
        setAdminStatus(null);
        const payload = { lat: adminLat, lon: adminLng, name: adminName, radius_m: adminRadius };
        console.log("[adminSave] sending:", payload);
        try {
            const res  = await fetch("/api/location/set", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { setAdminStatus(`Error: ${data.error ?? res.status}`); return; }
            setAdminLoc(data.location);
            setAdminStatus("Location saved!");
        } catch {
            setAdminStatus("Save failed");
        } finally {
            setAdminSaving(false);
        }
    };

    const adminToggle = async (active: boolean) => {
        setAdminSaving(true);
        try {
            const res  = await fetch("/api/location/activate", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ active }),
            });
            const data = await res.json();
            if (!res.ok) { setAdminStatus(`Error: ${data.error ?? res.status}`); return; }
            setAdminLoc(prev => prev ? { ...prev, is_active: active } : null);
            setAdminStatus(active ? "Venue is OPEN" : "Venue is CLOSED");
        } catch {
            setAdminStatus("Toggle failed");
        } finally {
            setAdminSaving(false);
        }
    };

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
                        {endGameData && (
                            <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 animate-fade-in">
                                <h1 className="font-marker text-6xl text-[#FF6D00] tracking-wider drop-shadow-[0_0_25px_#FF6D00]">
                                    GAME OVER
                                </h1>
                                <div
                                    className="font-boogaloo text-3xl mb-2"
                                    style={{ color: endGameData.winner?.color ?? "#fff" }}
                                >
                                    {endGameData.winner ? `${endGameData.winner.name} wins!` : 'Draw!'}
                                </div>

                                <div className="flex flex-col gap-3 min-w-[320px]">
                                    {endGameData.scores.map((p) => (
                                        <div key={p.id} className="flex justify-between items-center px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 font-boogaloo text-xl">
                                            <span style={{ color: p.color }}>{p.name}</span>
                                            <span className="font-marker" style={{ color: p.color }}>{p.pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className="flex flex-col items-center gap-8 px-8 py-10 w-full"
                        style={{ overflow: "visible", textAlign: "center" }}
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

            {/* Admin panel — shown only when ?admin=true */}
            {showAdmin && (
                <div
                    className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 rounded-2xl p-4 w-96"
                    style={{
                        background:  "rgba(10,10,18,0.97)",
                        border:      "1px solid rgba(0,229,255,.25)",
                        boxShadow:   "0 0 40px rgba(0,229,255,.12)",
                        maxHeight:   "94vh",
                        overflowY:   "auto",
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between shrink-0">
                        <p className="font-marker text-mm-cyan text-sm">Venue Admin</p>
                        <button onClick={() => setShowAdmin(false)} className="text-white/30 hover:text-white/70 text-xl leading-none">&times;</button>
                    </div>

                    {/* Current location status */}
                    {adminLoc && (
                        <div
                            className="px-3 py-2 rounded-xl text-xs font-boogaloo shrink-0"
                            style={{
                                background: adminLoc.is_active ? "rgba(118,255,3,.1)" : "rgba(255,45,120,.08)",
                                border:     `1px solid ${adminLoc.is_active ? "rgba(118,255,3,.3)" : "rgba(255,45,120,.2)"}`,
                                color:      adminLoc.is_active ? "#76FF03" : "#FF2D78",
                            }}
                        >
                            {adminLoc.is_active ? "OPEN" : "CLOSED"} — {adminLoc.name}
                            <span className="block text-white/30 text-[10px] mt-0.5">
                {adminLoc.lat.toFixed(5)}, {adminLoc.lon.toFixed(5)} · {adminLoc.radius_m}m
              </span>
                        </div>
                    )}

                    {/* Address search */}
                    <div className="flex gap-2 shrink-0">
                        <input
                            type="text"
                            value={addrInput}
                            onChange={e => setAddrInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && searchAddress()}
                            placeholder="Search address…"
                            className="flex-1 bg-mm-surface border border-white/10 focus:border-mm-cyan rounded-xl
                         px-3 py-2 font-boogaloo text-white text-sm outline-none placeholder:text-white/20"
                        />
                        <button
                            onClick={searchAddress}
                            disabled={addrSearching}
                            className="font-boogaloo text-xs px-3 py-2 rounded-xl text-white/80 transition-all hover:text-white shrink-0 disabled:opacity-40"
                            style={{ background: "rgba(0,229,255,.15)", border: "1px solid rgba(0,229,255,.3)" }}
                        >
                            {addrSearching ? "…" : "🔍"}
                        </button>
                    </div>

                    {/* GPS button */}
                    <button
                        onClick={adminGPS}
                        className="font-boogaloo text-sm px-3 py-2 rounded-xl text-white/80 transition-all hover:text-white shrink-0"
                        style={{ background: "rgba(0,229,255,.12)", border: "1px solid rgba(0,229,255,.2)" }}
                    >
                        📍 Use My Current Location
                    </button>

                    {/* Interactive Leaflet map */}
                    <div
                        ref={mapRef}
                        className="w-full rounded-xl overflow-hidden shrink-0"
                        style={{ height: 200, border: "1px solid rgba(255,255,255,.1)" }}
                    />
                    {!leafletLoaded && (
                        <p className="font-boogaloo text-white/20 text-xs text-center -mt-2">Loading map…</p>
                    )}

                    {/* Coordinate inputs */}
                    <div className="flex gap-2 shrink-0">
                        <div className="flex-1">
                            <p className="font-boogaloo text-white/30 text-xs mb-1">Latitude</p>
                            <input
                                type="text"
                                value={latStr}
                                onChange={e => {
                                    setLatStr(e.target.value);
                                    const n = parseFloat(e.target.value);
                                    if (!isNaN(n) && n >= -90 && n <= 90) {
                                        setAdminLat(n);
                                        if (markerRef.current) markerRef.current.setLatLng([n, adminLng ?? 34.7818]);
                                        if (leafletMapRef.current) leafletMapRef.current.setView([n, adminLng ?? 34.7818]);
                                    }
                                }}
                                className="w-full bg-mm-surface border border-white/10 focus:border-mm-cyan rounded-xl
                           px-2 py-1.5 font-mono text-white text-xs outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="font-boogaloo text-white/30 text-xs mb-1">Longitude</p>
                            <input
                                type="text"
                                value={lngStr}
                                onChange={e => {
                                    setLngStr(e.target.value);
                                    const n = parseFloat(e.target.value);
                                    if (!isNaN(n) && n >= -180 && n <= 180) {
                                        setAdminLng(n);
                                        if (markerRef.current) markerRef.current.setLatLng([adminLat ?? 32.0853, n]);
                                        if (leafletMapRef.current) leafletMapRef.current.setView([adminLat ?? 32.0853, n]);
                                    }
                                }}
                                className="w-full bg-mm-surface border border-white/10 focus:border-mm-cyan rounded-xl
                           px-2 py-1.5 font-mono text-white text-xs outline-none"
                            />
                        </div>
                    </div>

                    {/* Venue name */}
                    <input
                        type="text"
                        value={adminName}
                        onChange={e => setAdminName(e.target.value)}
                        placeholder="Venue name"
                        className="w-full bg-mm-surface border border-white/10 focus:border-mm-cyan rounded-xl
                       px-3 py-2 font-boogaloo text-white text-sm outline-none placeholder:text-white/20 shrink-0"
                    />

                    {/* Radius slider */}
                    <div className="shrink-0">
                        <div className="flex justify-between mb-1">
                            <span className="font-boogaloo text-white/40 text-xs">Radius</span>
                            <span className="font-marker text-mm-cyan text-xs">{adminRadius}m</span>
                        </div>
                        <input
                            type="range"
                            min={50} max={5000} step={50}
                            value={adminRadius}
                            onChange={e => setAdminRadius(Number(e.target.value))}
                            className="w-full accent-mm-cyan"
                        />
                    </div>

                    {/* Save button */}
                    <button
                        onClick={adminSave}
                        disabled={adminSaving || adminLat == null}
                        className="font-marker text-sm py-2 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 shrink-0"
                        style={{ background: "#00E5FF22", border: "1px solid #00E5FF66" }}
                    >
                        {adminSaving ? "Saving…" : "Save Location"}
                    </button>

                    {/* Open / Close venue */}
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => adminToggle(true)}
                            disabled={adminSaving}
                            className="flex-1 font-marker text-sm py-2 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40"
                            style={{ background: "rgba(118,255,3,.18)", border: "1px solid rgba(118,255,3,.4)" }}
                        >
                            Open Venue
                        </button>
                        <button
                            onClick={() => adminToggle(false)}
                            disabled={adminSaving}
                            className="flex-1 font-marker text-sm py-2 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40"
                            style={{ background: "rgba(255,45,120,.15)", border: "1px solid rgba(255,45,120,.3)" }}
                        >
                            Close Venue
                        </button>
                    </div>

                    {/* Status message */}
                    {adminStatus && (
                        <p className="font-boogaloo text-white/60 text-xs text-center shrink-0">{adminStatus}</p>
                    )}
                </div>
            )}
        </div>
    );
}