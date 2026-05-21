"use client";

import { useState } from "react";

export default function JoinGameButton({ previewColor }: { previewColor: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const join = async () => {
    setState("loading");
    setErrorMsg("");
    try {
      const res  = await fetch("/api/game/join", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to join");
      // Redirect phone to game controller
      window.location.href = data.controllerUrl;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs">
      <button
        onClick={join}
        disabled={state === "loading"}
        className="w-full font-marker text-2xl py-5 rounded-2xl text-white transition-all active:scale-95 disabled:opacity-60 select-none"
        style={{
          background:  previewColor,
          boxShadow:   `0 0 36px ${previewColor}99`,
          letterSpacing: "0.05em",
        }}
      >
        {state === "loading" ? "Joining…" : "JOIN GAME"}
      </button>

      {state === "error" && (
        <p className="font-boogaloo text-mm-orange text-sm text-center">{errorMsg}</p>
      )}
    </div>
  );
}
