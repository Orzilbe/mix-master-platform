"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  PlayerAvatar,
  AVATAR_COLORS,
  AVATAR_SHAPES,
  AVATAR_ACCESSORIES,
  DEFAULT_AVATAR,
} from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [loading,      setLoading]      = useState(true);
  const [username,     setUsername]     = useState("");
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");
  const [savedConfig,  setSavedConfig]  = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [draftConfig,  setDraftConfig]  = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [saving,       setSaving]       = useState(false);
  const [saveStatus,   setSaveStatus]   = useState<"idle" | "saved" | "error">("idle");

  // Stats
  const [gamesPlayed,    setGamesPlayed]    = useState(0);
  const [bestScore,      setBestScore]      = useState(0);
  const [weeklyRank,     setWeeklyRank]     = useState<number | null>(null);
  const [weeklyScore,    setWeeklyScore]    = useState(0);
  const [notifStatus,    setNotifStatus]    = useState<"idle" | "loading" | "enabled" | "denied" | "error">("idle");
  const [notifSupported, setNotifSupported] = useState(true);

  const hasUnsaved = JSON.stringify(draftConfig) !== JSON.stringify(savedConfig);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotifSupported(false);
      return;
    }
    if (Notification.permission === "granted") setNotifStatus("enabled");
    if (Notification.permission === "denied")  setNotifStatus("denied");
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/login"); return; }

    fetch("/api/profile/me")
      .then(r => r.json())
      .then(({ player, weeklyRank: wr, weeklyScore: ws, gamesPlayed: gp, bestScore: bs }) => {
        if (player?.username) { setUsername(player.username); setNameInput(player.username); }
        if (player?.avatar_config) {
          setSavedConfig(player.avatar_config as AvatarConfig);
          setDraftConfig(player.avatar_config as AvatarConfig);
        }
        setWeeklyRank(wr ?? null);
        setWeeklyScore(ws ?? 0);
        setGamesPlayed(gp ?? 0);
        setBestScore(bs ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setUsername(user.username ?? user.firstName ?? "");
        setNameInput(user.username ?? user.firstName ?? "");
        setLoading(false);
      });
  }, [isLoaded, user, router]);

  const save = async (overrideConfig?: AvatarConfig) => {
    const cfg = overrideConfig ?? draftConfig;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/profile/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), avatar_config: cfg }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedConfig(cfg);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setUsername(nameInput.trim());
    setEditingName(false);
    await save();
  };

  const updateConfig = (next: AvatarConfig) => {
    setDraftConfig(next);
  };

  const enableNotifications = async () => {
    setNotifStatus("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setNotifStatus("denied"); return; }

      const reg   = await navigator.serviceWorker.ready;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      let subData: object = { permissionGranted: true };
      if (vapid) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
        subData = sub.toJSON();
      }

      const res = await fetch("/api/profile/push-subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(subData),
      });
      if (!res.ok) throw new Error("Save failed");
      setNotifStatus("enabled");
    } catch {
      setNotifStatus("error");
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-mm-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-mm-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mm-bg pb-16 px-4">
      <style>{`
        @keyframes save-glow {
          0%, 100% { box-shadow: 0 0 18px #22c55e88; }
          50%       { box-shadow: 0 0 52px #22c55ecc, 0 0 90px #22c55e33; }
        }
        .save-pulse { animation: save-glow 1.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.replace("/join")}
          className="font-boogaloo text-white/40 text-2xl leading-none px-1 hover:text-white/70 transition-colors"
          aria-label="Back to join"
        >
          ←
        </button>
        <h1 className="font-marker text-xl text-mm-cyan flex-1 text-center">My Profile</h1>
        <div className="w-8" />
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center mb-6">
        <div
          className="w-36 h-36 rounded-full flex items-center justify-center relative"
          style={{
            background: `${draftConfig.color}18`,
            border:     `3px solid ${draftConfig.color}`,
            boxShadow:  `0 0 40px ${draftConfig.color}55`,
          }}
        >
          <PlayerAvatar config={draftConfig} size={104} />
          {saving && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-mm-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Save confirmation */}
      {saveStatus !== "idle" && (
        <p className={`text-center font-boogaloo text-sm mb-4 ${saveStatus === "saved" ? "text-green-400" : "text-red-400"}`}>
          {saveStatus === "saved" ? "✅ Saved!" : "Save failed — try again"}
        </p>
      )}

      {/* Username */}
      <Section label="USERNAME">
        {editingName ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
              className="flex-1 bg-mm-surface border-2 border-mm-cyan rounded-xl px-4 py-3
                         font-marker text-white text-lg outline-none"
            />
            <button
              onClick={saveName}
              className="font-marker text-sm px-4 py-3 rounded-xl text-white"
              style={{ background: draftConfig.color }}
            >
              OK
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-marker text-2xl text-white flex-1">{username}</span>
            <button
              onClick={() => { setNameInput(username); setEditingName(true); }}
              className="font-boogaloo text-white/40 text-sm hover:text-white/70 transition-colors px-2"
            >
              ✏️ Edit
            </button>
          </div>
        )}
      </Section>

      {/* Shape picker */}
      <Section label="CHARACTER">
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_SHAPES.map(({ id, label }) => {
            const active = draftConfig.shape === id;
            return (
              <button
                key={id}
                onClick={() => updateConfig({ ...draftConfig, shape: id })}
                className="flex flex-col items-center gap-1 pt-3 pb-2 rounded-2xl transition-all"
                style={{
                  background: active ? `${draftConfig.color}20` : "rgba(255,255,255,.04)",
                  border:     `2px solid ${active ? draftConfig.color : "rgba(255,255,255,.1)"}`,
                  boxShadow:  active ? `0 0 18px ${draftConfig.color}44` : "none",
                }}
              >
                <PlayerAvatar config={{ ...draftConfig, shape: id }} size={56} />
                <span
                  className="font-boogaloo text-xs"
                  style={{ color: active ? draftConfig.color : "rgba(255,255,255,.45)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Color picker */}
      <Section label="COLOR">
        <div className="flex gap-3 justify-center">
          {AVATAR_COLORS.map(c => {
            const active = draftConfig.color === c;
            return (
              <button
                key={c}
                onClick={() => updateConfig({ ...draftConfig, color: c })}
                className="w-14 h-14 rounded-full transition-all"
                style={{
                  background: c,
                  border:     active ? "4px solid #fff" : "4px solid transparent",
                  boxShadow:  active ? `0 0 24px ${c}` : "none",
                  transform:  active ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
        </div>
      </Section>

      {/* Accessory picker */}
      <Section label="ACCESSORY">
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_ACCESSORIES.map(({ id, label }) => {
            const active = draftConfig.accessory === id;
            return (
              <button
                key={id}
                onClick={() => updateConfig({ ...draftConfig, accessory: id })}
                className="flex flex-col items-center gap-1 pt-2 pb-1 rounded-2xl transition-all"
                style={{
                  background: active ? `${draftConfig.color}20` : "rgba(255,255,255,.04)",
                  border:     `2px solid ${active ? draftConfig.color : "rgba(255,255,255,.1)"}`,
                }}
              >
                <PlayerAvatar config={{ ...draftConfig, accessory: id }} size={44} />
                <span
                  className="font-boogaloo text-xs"
                  style={{ color: active ? draftConfig.color : "rgba(255,255,255,.35)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Save button — only visible when there are unsaved changes */}
      {hasUnsaved && (
        <div className="flex flex-col items-center gap-3 mb-7">
          <p className="font-boogaloo text-yellow-400 text-sm animate-pulse">⚠️ Unsaved changes</p>
          <button
            onClick={() => save()}
            disabled={saving}
            className="save-pulse font-marker text-2xl px-14 py-4 rounded-2xl text-white
                       transition-all active:scale-95 disabled:opacity-60"
            style={{
              background: "#16a34a",
              border:     "2px solid #22c55e",
            }}
          >
            {saving ? "Saving…" : "💾 SAVE"}
          </button>
        </div>
      )}

      {/* Stats */}
      <Section label="STATS">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Games"     value={gamesPlayed}                                  color={draftConfig.color} />
          <StatCard label="Best"      value={`${(bestScore / 10).toFixed(1)}%`}            color={draftConfig.color} />
          <StatCard label="This week" value={weeklyRank != null ? `#${weeklyRank}` : "—"}  color={draftConfig.color} />
        </div>
        {weeklyScore > 0 && (
          <p className="font-boogaloo text-white/30 text-xs text-center mt-2">
            {weeklyScore} pts this week
          </p>
        )}
      </Section>

      {/* Notifications */}
      {notifSupported && (
        <Section label="NOTIFICATIONS">
          {notifStatus === "enabled" ? (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${draftConfig.color}15`, border: `1px solid ${draftConfig.color}33` }}
            >
              <span className="text-green-400 text-lg">✅</span>
              <span className="font-boogaloo text-white/70 text-sm">Notifications enabled!</span>
            </div>
          ) : notifStatus === "denied" ? (
            <p className="font-boogaloo text-white/35 text-sm text-center py-1">
              🚫 Notifications blocked — enable in browser settings
            </p>
          ) : (
            <button
              onClick={enableNotifications}
              disabled={notifStatus === "loading"}
              className="w-full font-marker text-base py-3 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(255,45,120,.15)", border: "1px solid rgba(255,45,120,.3)" }}
            >
              {notifStatus === "loading" ? "Enabling…" : notifStatus === "error" ? "❌ Error — try again" : "🔔 Enable Notifications"}
            </button>
          )}
        </Section>
      )}

      {/* Sign out */}
      <button
        onClick={() => signOut({ redirectUrl: "/login" })}
        className="w-full font-marker text-lg py-4 rounded-2xl text-white/80 transition-all
                   active:scale-95 hover:text-white mt-4"
        style={{
          background: "rgba(255,45,120,.12)",
          border:     "1px solid rgba(255,45,120,.3)",
        }}
      >
        SIGN OUT
      </button>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="font-marker text-xs text-white/35 tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl px-3 py-4 text-center"
      style={{ background: `${color}10`, border: `1px solid ${color}22` }}
    >
      <span className="font-boogaloo text-white/40 text-xs uppercase tracking-wide">{label}</span>
      <span className="font-marker text-2xl" style={{ color }}>{value}</span>
    </div>
  );
}
