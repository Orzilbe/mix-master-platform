"use client";

// Pure CSS + SVG graffiti waiting animation — no external deps.

const C = ["#FF2D78", "#00E5FF", "#76FF03", "#FF6D00"];

const SPLATTERS = [
  { cx: "9%",  cy: "16%", r: 14, ci: 0 },
  { cx: "20%", cy: "72%", r: 9,  ci: 1 },
  { cx: "63%", cy: "23%", r: 17, ci: 2 },
  { cx: "82%", cy: "58%", r: 11, ci: 3 },
  { cx: "44%", cy: "85%", r: 8,  ci: 0 },
  { cx: "53%", cy: "10%", r: 20, ci: 1 },
  { cx: "17%", cy: "48%", r: 10, ci: 2 },
  { cx: "88%", cy: "78%", r: 13, ci: 3 },
  { cx: "37%", cy: "36%", r: 7,  ci: 0 },
  { cx: "74%", cy: "90%", r: 15, ci: 1 },
  { cx: "29%", cy: "61%", r: 6,  ci: 2 },
  { cx: "59%", cy: "43%", r: 9,  ci: 3 },
];

const PARTICLES = [
  { left: "11%", delay: "0s",   size: 6, ci: 0, dur: "3.5s" },
  { left: "27%", delay: "0.7s", size: 4, ci: 1, dur: "4.2s" },
  { left: "43%", delay: "1.4s", size: 8, ci: 2, dur: "3.0s" },
  { left: "57%", delay: "0.3s", size: 5, ci: 3, dur: "4.8s" },
  { left: "74%", delay: "1.1s", size: 7, ci: 0, dur: "3.8s" },
  { left: "85%", delay: "0.5s", size: 4, ci: 1, dur: "4.1s" },
  { left: "19%", delay: "2.0s", size: 6, ci: 2, dur: "3.3s" },
  { left: "66%", delay: "1.8s", size: 5, ci: 3, dur: "4.5s" },
  { left: "38%", delay: "2.5s", size: 4, ci: 0, dur: "3.7s" },
  { left: "50%", delay: "0.9s", size: 7, ci: 1, dur: "4.0s" },
];

// Drip positions as % of the text container width; ci=0 → MIX color, ci=1 → MASTER color
const DRIPS = [
  { left: "4%",  h: 38, ci: 0 },
  { left: "12%", h: 55, ci: 0 },
  { left: "19%", h: 42, ci: 0 },
  { left: "27%", h: 30, ci: 0 },
  { left: "54%", h: 62, ci: 1 },
  { left: "61%", h: 38, ci: 1 },
  { left: "69%", h: 52, ci: 1 },
  { left: "79%", h: 46, ci: 1 },
  { left: "84%", h: 33, ci: 1 },
  { left: "91%", h: 67, ci: 1 },
];

export function GraffitiAnimation({ visible }: { visible: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 1.2s ease", pointerEvents: "none" }}
    >
      <style>{KEYFRAMES}</style>

      {/* Brick wall */}
      <div className="absolute inset-0">
        <svg className="w-full h-full">
          <defs>
            <pattern id="mm-bricks" x="0" y="0" width="122" height="66" patternUnits="userSpaceOnUse">
              <rect width="122" height="66" fill="#0e0b09" />
              {/* odd row */}
              <rect x="1"   y="1"  width="57" height="28" rx="2" fill="#231714" />
              <rect x="64"  y="1"  width="57" height="28" rx="2" fill="#1e1310" />
              {/* even row — offset by half brick */}
              <rect x="-29" y="35" width="57" height="28" rx="2" fill="#1e1310" />
              <rect x="33"  y="35" width="57" height="28" rx="2" fill="#231714" />
              <rect x="95"  y="35" width="57" height="28" rx="2" fill="#1e1310" />
            </pattern>
            <radialGradient id="mm-vig" cx="50%" cy="50%" r="70%">
              <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.65)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#mm-bricks)" />
          <rect width="100%" height="100%" fill="url(#mm-vig)" />
        </svg>
      </div>

      {/* Paint splatters */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        {SPLATTERS.map((s, i) => (
          <g key={i}>
            <circle cx={s.cx} cy={s.cy} r={s.r}         fill={C[s.ci]} opacity={0.14} />
            <circle cx={s.cx} cy={s.cy} r={s.r * 1.7}   fill={C[s.ci]} opacity={0.05} />
          </g>
        ))}
      </svg>

      {/* Graffiti text + drips */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ userSelect: "none" }}>
          <div
            className="font-marker flex gap-3"
            style={{ fontSize: "clamp(52px, 8.5vw, 104px)", lineHeight: 1.05, whiteSpace: "nowrap" }}
          >
            <span
              style={{
                opacity: 0,
                display: "inline-block",
                WebkitTextStroke: "1px rgba(255,255,255,0.12)",
                animation: "mm-reveal-mix 5s linear infinite, mm-col1 20s linear infinite",
              }}
            >
              MIX
            </span>
            <span
              style={{
                opacity: 0,
                display: "inline-block",
                WebkitTextStroke: "1px rgba(255,255,255,0.12)",
                animation: "mm-reveal-master 5s linear infinite, mm-col2 20s linear infinite",
              }}
            >
              MASTER
            </span>
          </div>

          {/* Drips below text */}
          <div className="absolute left-0 right-0" style={{ top: "100%", height: 80 }}>
            {DRIPS.map((d, i) => (
              <div
                key={i}
                style={{
                  position:        "absolute",
                  left:            d.left,
                  top:             0,
                  width:           6,
                  height:          d.h,
                  borderRadius:    "0 0 4px 4px",
                  transformOrigin: "top center",
                  willChange:      "transform",
                  animation:       `mm-drip 5s linear infinite, ${d.ci === 0 ? "mm-drip-col1" : "mm-drip-col2"} 20s linear infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Spray can */}
      <div
        className="absolute"
        style={{ top: "calc(50% - 58px)", left: 0, willChange: "transform", animation: "mm-can 5s linear infinite" }}
      >
        <SprayCan />
      </div>

      {/* Floating paint particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            left:         p.left,
            bottom:       "22%",
            width:        p.size,
            height:       p.size,
            borderRadius: "50%",
            background:   C[p.ci],
            boxShadow:    `0 0 ${p.size * 2}px ${C[p.ci]}`,
            willChange:   "transform",
            animation:    `mm-particle ${p.dur} ease-out ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SprayCan() {
  return (
    <svg width="46" height="100" viewBox="0 0 46 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <rect x="9"  y="30" width="28" height="62" rx="6" fill="#cccccc" />
      {/* Shine strip */}
      <rect x="9"  y="30" width="12" height="62" rx="6" fill="rgba(255,255,255,0.12)" />
      {/* Label */}
      <rect x="12" y="40" width="22" height="34" rx="2" fill="#FF2D78" />
      <rect x="14" y="45" width="18" height="2"  rx="1" fill="rgba(255,255,255,0.6)" />
      <rect x="14" y="50" width="12" height="2"  rx="1" fill="rgba(255,255,255,0.35)" />
      <rect x="14" y="55" width="15" height="2"  rx="1" fill="rgba(255,255,255,0.35)" />
      <rect x="14" y="60" width="10" height="2"  rx="1" fill="rgba(255,255,255,0.2)" />
      {/* Shoulder */}
      <rect x="11" y="19" width="24" height="13" rx="4" fill="#b8b8b8" />
      {/* Cap */}
      <rect x="14" y="8"  width="16" height="13" rx="3" fill="#888888" />
      {/* Nozzle */}
      <rect x="30" y="12" width="13" height="5"  rx="2" fill="#707070" />
      <circle cx="44" cy="14" r="3" fill="#505050" />
      {/* Spray mist */}
      <g style={{ animation: "mm-mist 0.38s ease-out infinite", transformOrigin: "44px 14px" }}>
        <ellipse cx="51" cy="14" rx="5"   ry="3.5" fill="#FF2D78" opacity="0.75" />
        <ellipse cx="57" cy="11" rx="4"   ry="2.2" fill="#FF2D78" opacity="0.50" />
        <ellipse cx="57" cy="17" rx="4"   ry="2.2" fill="#FF2D78" opacity="0.40" />
        <circle  cx="55" cy="8"  r="2.2"            fill="#FF2D78" opacity="0.35" />
        <circle  cx="61" cy="12" r="1.6"            fill="#FF2D78" opacity="0.28" />
        <circle  cx="61" cy="17" r="1.6"            fill="#FF2D78" opacity="0.22" />
        <circle  cx="64" cy="10" r="1.1"            fill="#FF2D78" opacity="0.18" />
        <circle  cx="64" cy="16" r="1.1"            fill="#FF2D78" opacity="0.15" />
      </g>
    </svg>
  );
}

const KEYFRAMES = `
  @keyframes mm-can {
    0%   { transform: translateX(-80px)  rotate(-3deg); }
    68%  { transform: translateX(2400px) rotate(3deg);  }
    100% { transform: translateX(2400px) rotate(3deg);  }
  }

  @keyframes mm-reveal-mix {
    0%   { clip-path: inset(0 100% 0 0); opacity: 1; }
    36%  { clip-path: inset(0 0%   0 0); opacity: 1; }
    86%  { clip-path: inset(0 0%   0 0); opacity: 1; }
    100% { clip-path: inset(0 0%   0 0); opacity: 0; }
  }

  @keyframes mm-reveal-master {
    0%   { clip-path: inset(0 100% 0 0); opacity: 1; }
    28%  { clip-path: inset(0 100% 0 0); opacity: 1; }
    68%  { clip-path: inset(0 0%   0 0); opacity: 1; }
    86%  { clip-path: inset(0 0%   0 0); opacity: 1; }
    100% { clip-path: inset(0 0%   0 0); opacity: 0; }
  }

  @keyframes mm-col1 {
    0%   { color: #FF2D78; text-shadow: 0 0 36px #FF2D78bb, 0 0 72px #FF2D7844; }
    25%  { color: #00E5FF; text-shadow: 0 0 36px #00E5FFbb, 0 0 72px #00E5FF44; }
    50%  { color: #76FF03; text-shadow: 0 0 36px #76FF03bb, 0 0 72px #76FF0344; }
    75%  { color: #FF6D00; text-shadow: 0 0 36px #FF6D00bb, 0 0 72px #FF6D0044; }
    100% { color: #FF2D78; text-shadow: 0 0 36px #FF2D78bb, 0 0 72px #FF2D7844; }
  }

  @keyframes mm-col2 {
    0%   { color: #00E5FF; text-shadow: 0 0 36px #00E5FFbb, 0 0 72px #00E5FF44; }
    25%  { color: #76FF03; text-shadow: 0 0 36px #76FF03bb, 0 0 72px #76FF0344; }
    50%  { color: #FF6D00; text-shadow: 0 0 36px #FF6D00bb, 0 0 72px #FF6D0044; }
    75%  { color: #FF2D78; text-shadow: 0 0 36px #FF2D78bb, 0 0 72px #FF2D7844; }
    100% { color: #00E5FF; text-shadow: 0 0 36px #00E5FFbb, 0 0 72px #00E5FF44; }
  }

  @keyframes mm-drip {
    0%,  54% { transform: scaleY(0); opacity: 0; }
    57%      { opacity: 0.9; }
    80%      { transform: scaleY(1); opacity: 0.85; }
    93%      { transform: scaleY(1); opacity: 0;    }
    100%     { transform: scaleY(0); opacity: 0;    }
  }

  @keyframes mm-drip-col1 {
    0%   { background: #FF2D78; box-shadow: 0 6px 14px #FF2D78; }
    25%  { background: #00E5FF; box-shadow: 0 6px 14px #00E5FF; }
    50%  { background: #76FF03; box-shadow: 0 6px 14px #76FF03; }
    75%  { background: #FF6D00; box-shadow: 0 6px 14px #FF6D00; }
    100% { background: #FF2D78; box-shadow: 0 6px 14px #FF2D78; }
  }

  @keyframes mm-drip-col2 {
    0%   { background: #00E5FF; box-shadow: 0 6px 14px #00E5FF; }
    25%  { background: #76FF03; box-shadow: 0 6px 14px #76FF03; }
    50%  { background: #FF6D00; box-shadow: 0 6px 14px #FF6D00; }
    75%  { background: #FF2D78; box-shadow: 0 6px 14px #FF2D78; }
    100% { background: #00E5FF; box-shadow: 0 6px 14px #00E5FF; }
  }

  @keyframes mm-particle {
    0%   { transform: translateY(0px)   scale(1);   opacity: 0.85; }
    100% { transform: translateY(-90px) scale(0.2); opacity: 0;    }
  }

  @keyframes mm-mist {
    0%   { opacity: 0;   transform: scale(0.4) translateX(0px);  }
    35%  { opacity: 0.8; transform: scale(1)   translateX(4px);  }
    100% { opacity: 0;   transform: scale(1.5) translateX(14px); }
  }
`;
