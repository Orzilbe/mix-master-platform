"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Navbar from "@/components/Navbar";
import LocationGate from "@/components/LocationGate";

const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ?? "https://mix-master-8gh1.onrender.com/display";

type Toast = { state: "saving" } | { state: "saved"; score: number } | { state: "no-match" };

export default function PlayPage() {
  const { user } = useUser();
  const [toast, setToast]     = useState<Toast | null>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(t: Toast, autoDismissMs = 5000) {
    setToast(t);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoDismissMs > 0)
      timerRef.current = setTimeout(() => setToast(null), autoDismissMs);
  }

  useEffect(() => {
    const handle = async (e: MessageEvent) => {
      if (e.data?.type !== "mix-master-game-end") return;
      if (!user) return;

      const myName   = (user.username ?? user.firstName ?? "").toLowerCase();
      const scores: { name: string; pct: number }[] = e.data.scores ?? [];
      const myScore  = scores.find(s => s.name.toLowerCase() === myName);

      if (!myScore) { showToast({ state: "no-match" }); return; }

      showToast({ state: "saving" }, 0);
      try {
        const res = await fetch("/api/scores", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          // pct is 0–100 with one decimal; store as integer 0–1000 for precision
          body: JSON.stringify({ score: Math.round(myScore.pct * 10) }),
        });
        if (res.ok) showToast({ state: "saved", score: Math.round(myScore.pct * 10) });
        else        showToast({ state: "no-match" });
      } catch {
        setToast(null);
      }
    };

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <LocationGate>
        <div className="flex-1 relative" style={{ minHeight: "calc(100vh - 57px)" }}>

          <iframe
            src={GAME_URL}
            className="absolute inset-0 w-full h-full border-0"
            allow="fullscreen"
            title="Mix Master Arena"
          />

          {/* Toast overlay */}
          {toast && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-mm-surface border rounded-xl px-6 py-3 shadow-lg whitespace-nowrap"
              style={{
                borderColor: toast.state === "saved" ? "rgba(118,255,3,.5)" : "rgba(255,255,255,.1)",
                boxShadow:   toast.state === "saved" ? "0 0 20px rgba(118,255,3,.2)" : undefined,
              }}
            >
              {toast.state === "saving" && (
                <>
                  <div className="w-4 h-4 border-2 border-mm-cyan border-t-transparent rounded-full animate-spin" />
                  <span className="font-boogaloo text-mm-cyan text-sm">Saving score…</span>
                </>
              )}
              {toast.state === "saved" && (
                <>
                  <span className="text-mm-green text-lg leading-none">✓</span>
                  <span className="font-boogaloo text-mm-green text-sm">
                    Score saved — {toast.score} pts!
                  </span>
                </>
              )}
              {toast.state === "no-match" && (
                <>
                  <span className="text-mm-orange text-lg leading-none">!</span>
                  <span className="font-boogaloo text-gray-400 text-sm">
                    Name not matched — use your platform username in-game.
                  </span>
                </>
              )}
            </div>
          )}

        </div>
      </LocationGate>
    </div>
  );
}
