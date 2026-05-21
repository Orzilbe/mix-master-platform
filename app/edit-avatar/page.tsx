"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  PlayerAvatar,
  AVATAR_COLORS,
  AVATAR_SHAPES,
  AVATAR_ACCESSORIES,
  DEFAULT_AVATAR,
} from "@/components/PlayerAvatar";
import type { AvatarConfig } from "@/lib/types";

export default function EditAvatarPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [username, setUsername] = useState("");
  const [config,   setConfig]   = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/login"); return; }

    fetch("/api/profile/me")
      .then(r => r.json())
      .then(({ player }) => {
        if (player?.username) setUsername(player.username);
        if (player?.avatar_config) setConfig(player.avatar_config as AvatarConfig);
        setLoading(false);
      })
      .catch(() => {
        setUsername(user.username ?? user.firstName ?? "");
        setLoading(false);
      });
  }, [isLoaded, user, router]);

  const save = async () => {
    if (!username.trim()) { setError("Enter a username"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), avatar_config: config }),
      });
      if (!res.ok) throw new Error("Save failed");
      router.replace("/join");
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
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
    <div className="min-h-screen bg-mm-bg pb-10 px-5">

      {/* Header */}
      <div className="pt-8 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="font-boogaloo text-white/40 text-2xl leading-none px-1"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-marker text-2xl text-mm-cyan">Edit Avatar</h1>
          <p className="font-boogaloo text-white/40 text-sm mt-0.5">Your graffiti identity</p>
        </div>
        <div className="w-8" />
      </div>

      {/* Live preview */}
      <div className="flex justify-center mb-7">
        <div
          className="w-36 h-36 rounded-full flex items-center justify-center"
          style={{
            background: `${config.color}18`,
            border:     `3px solid ${config.color}`,
            boxShadow:  `0 0 40px ${config.color}55`,
          }}
        >
          <PlayerAvatar config={config} size={104} />
        </div>
      </div>

      {/* Username */}
      <Section label="USERNAME">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          maxLength={20}
          placeholder="your tag"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full bg-mm-surface border-2 border-white/10 focus:border-mm-cyan rounded-xl
                     px-4 py-3 font-marker text-white text-lg outline-none
                     placeholder:text-white/20 transition-colors"
        />
      </Section>

      {/* Shape picker */}
      <Section label="CHARACTER">
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_SHAPES.map(({ id, label }) => {
            const active = config.shape === id;
            return (
              <button
                key={id}
                onClick={() => setConfig(c => ({ ...c, shape: id }))}
                className="flex flex-col items-center gap-1 pt-3 pb-2 rounded-2xl transition-all"
                style={{
                  background: active ? `${config.color}20` : "rgba(255,255,255,.04)",
                  border:     `2px solid ${active ? config.color : "rgba(255,255,255,.1)"}`,
                  boxShadow:  active ? `0 0 18px ${config.color}44` : "none",
                }}
              >
                <PlayerAvatar config={{ ...config, shape: id }} size={56} />
                <span
                  className="font-boogaloo text-xs"
                  style={{ color: active ? config.color : "rgba(255,255,255,.45)" }}
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
        <div className="flex flex-wrap gap-3 justify-center">
          {AVATAR_COLORS.map(c => {
            const active = config.color === c;
            return (
              <button
                key={c}
                onClick={() => setConfig(cfg => ({ ...cfg, color: c }))}
                className="w-12 h-12 rounded-full transition-all"
                style={{
                  background: c,
                  border:     active ? "3px solid #fff" : "3px solid transparent",
                  boxShadow:  active ? `0 0 20px ${c}` : "none",
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
            const active = config.accessory === id;
            return (
              <button
                key={id}
                onClick={() => setConfig(c => ({ ...c, accessory: id }))}
                className="flex flex-col items-center gap-1 pt-2 pb-1 rounded-2xl transition-all"
                style={{
                  background: active ? `${config.color}20` : "rgba(255,255,255,.04)",
                  border:     `2px solid ${active ? config.color : "rgba(255,255,255,.1)"}`,
                }}
              >
                <PlayerAvatar config={{ ...config, accessory: id }} size={44} />
                <span
                  className="font-boogaloo text-xs"
                  style={{ color: active ? config.color : "rgba(255,255,255,.35)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {error && (
        <p className="font-boogaloo text-red-400 text-center mb-3">{error}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full font-marker text-xl py-4 rounded-2xl text-white transition-all
                   active:scale-95 disabled:opacity-60"
        style={{
          background: config.color,
          boxShadow:  `0 0 30px ${config.color}55`,
        }}
      >
        {saving ? "Saving…" : "SAVE →"}
      </button>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="font-marker text-xs text-white/35 tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );
}
