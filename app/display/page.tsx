"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { PlayerAvatar, DEFAULT_AVATAR } from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;
// Always use the canonical production URL — never window.location.origin
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mix-master-gray.vercel.app";
const JOIN_URL = `${APP_URL}/join`;
const QR_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=111111&bgcolor=ffffff&data=${encodeURIComponent(JOIN_URL)}`;

type LobbyPlayer = {
  slotId:       number;
  userId:       string;
  username:     string;
  avatarUrl:    string | null;
  avatarConfig: AvatarConfig | null;
  color:        string;
};

type Phase = "lobby" | "game";

export default function DisplayPage() {
  const [phase, setPhase]     = useState<Phase>("lobby");
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const socketRef             = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(GAME_SERVER, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.emit("display-join");

    socket.on("lobby-update", (lobby: LobbyPlayer[]) => setPlayers(lobby));
    socket.on("game-start",   () => setPhase("game"));
    socket.on("game-end",     () => {
      setTimeout(() => { setPhase("lobby"); setPlayers([]); }, 8000);
    });

    return () => { socket.disconnect(); };
  }, []);

  /* ── Game phase — fullscreen game canvas iframe ───────────────────────── */
  if (phase === "game") {
    return (
      <iframe
        src={`${GAME_SERVER}/display?embed=1`}
        className="fixed inset-0 w-full h-full border-0"
        title="Mix Master"
        allow="fullscreen"
      />
    );
  }

  /* ── Lobby phase ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-mm-bg flex flex-col items-center justify-center gap-10 px-8 py-12">

      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${GAME_SERVER}/mixMaster.png`}
        alt="Mix Master"
        className="h-20 object-contain"
        style={{ filter: "drop-shadow(0 0 24px rgba(0,229,255,.45))" }}
      />

      {/* QR code */}
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={QR_SRC}
          alt="Scan to join"
          width={240}
          height={240}
          className="rounded-2xl border-[5px] border-white shadow-2xl"
        />
        <p className="font-boogaloo text-white/40 text-xl tracking-widest uppercase">
          Scan to join the game
        </p>
      </div>

      {/* Connected player cards */}
      {players.length > 0 && (
        <div className="flex gap-6 flex-wrap justify-center">
          {players.map(p => (
            <div
              key={p.slotId}
              className="flex flex-col items-center gap-3 bg-mm-surface rounded-2xl px-6 py-5"
              style={{ border: `2px solid ${p.color}`, boxShadow: `0 0 24px ${p.color}44` }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width:      "6rem",
                  height:     "6rem",
                  background: `${p.color}18`,
                  border:     `2px solid ${p.color}`,
                  boxShadow:  `0 0 20px ${p.color}44`,
                }}
              >
                <PlayerAvatar
                  config={{ ...(p.avatarConfig ?? DEFAULT_AVATAR), color: p.color }}
                  size={72}
                />
              </div>
              <span className="font-marker text-base" style={{ color: p.color }}>
                {p.username}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status / start */}
      {players.length === 0 && (
        <p className="font-boogaloo text-white/25 text-lg">
          Waiting for players to scan…
        </p>
      )}
      {players.length === 1 && (
        <p className="font-boogaloo text-white/35 text-lg">
          1 player connected — need at least 1 more…
        </p>
      )}
      {players.length >= 2 && (
        <button
          onClick={() => socketRef.current?.emit("game-start")}
          className="font-marker text-2xl px-14 py-5 rounded-2xl text-white transition-transform hover:scale-105 active:scale-95"
          style={{ background: "#FF2D78", boxShadow: "0 0 40px rgba(255,45,120,.6)" }}
        >
          START GAME
        </button>
      )}
    </div>
  );
}
