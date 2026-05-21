"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "allowed" | "denied" | "skipped";

export default function LocationGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus]     = useState<Status>("checking");
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setStatus("skipped"); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/check-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          });
          const data = await res.json();
          if (data.reason === "no_venue_configured") { setStatus("skipped"); return; }
          setStatus(data.allowed ? "allowed" : "denied");
          setDistance(data.distanceMeters ?? null);
        } catch {
          setStatus("skipped"); // network error → let through
        }
      },
      () => setStatus("skipped"), // user denied geolocation → let through
    );
  }, []);

  if (status === "checking") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mm-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-mm-surface rounded-2xl p-8 text-center max-w-sm border border-mm-orange/40">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="font-marker text-2xl text-mm-orange mb-3">Too Far Away</h2>
          <p className="font-boogaloo text-gray-400 leading-relaxed">
            You need to be at the venue to play.
            {distance !== null && (
              <span className="block mt-1 text-mm-orange">{distance}m away</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
