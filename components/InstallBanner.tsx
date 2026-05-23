"use client";

import { useState, useEffect } from "react";

export function InstallBanner() {
  const [show,  setShow]  = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    const ua         = navigator.userAgent;
    const ios        = /iPhone|iPad|iPod/.test(ua);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const standalone = (navigator as any).standalone === true ||
                       window.matchMedia("(display-mode: standalone)").matches;

    if (standalone) return;

    setIsIOS(ios);
    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("pwa-banner-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 py-4 safe-bottom"
      style={{
        background: "rgba(15,15,15,0.97)",
        borderTop:  "2px solid #FF2D78",
        boxShadow:  "0 -4px 30px rgba(255,45,120,0.3)",
      }}
    >
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <div className="flex-1">
          <p className="font-marker text-white text-sm mb-1">
            📲 Add Mix Master to your home screen!
          </p>
          <p className="font-boogaloo text-white/55 text-xs">
            {isIOS
              ? "Tap the Share icon → Add to Home Screen"
              : "Tap ⋮ menu → Add to Home Screen"}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="font-boogaloo text-white/40 hover:text-white/80 text-2xl leading-none px-1 flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
