"use client";

import { io, Socket } from "socket.io-client";

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER_URL!;

let socket: Socket | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getGameSocket(): Socket {
  if (!GAME_SERVER) {
    throw new Error("NEXT_PUBLIC_GAME_SERVER_URL is not configured");
  }

  if (!socket) {
    socket = io(GAME_SERVER, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }

  cancelGameSocketDisconnect();

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function peekGameSocket(): Socket | null {
  return socket;
}

export function cancelGameSocketDisconnect() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}

export function scheduleGameSocketDisconnect(delayMs = 120_000) {
  cancelGameSocketDisconnect();

  disconnectTimer = setTimeout(() => {
    disconnectTimer = null;
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }, delayMs);
}

export function disconnectGameSocketNow() {
  cancelGameSocketDisconnect();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
