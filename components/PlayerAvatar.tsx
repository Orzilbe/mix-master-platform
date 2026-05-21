"use client";

import type { AvatarShape, AvatarAccessory, AvatarConfig } from "@/lib/types";

export type { AvatarShape, AvatarAccessory, AvatarConfig };

export const AVATAR_COLORS: string[] = [
  '#FF2D78', '#00E5FF', '#76FF03', '#FF6D00',
  '#D500F9', '#FFD600', '#FF1744', '#FFFFFF',
];

export const AVATAR_SHAPES: { id: AvatarShape; label: string }[] = [
  { id: 'spray-can', label: 'Spray Can' },
  { id: 'robot',     label: 'Robot'     },
  { id: 'alien',     label: 'Alien'     },
  { id: 'cat',       label: 'Cat'       },
];

export const AVATAR_ACCESSORIES: { id: AvatarAccessory; label: string }[] = [
  { id: 'none',       label: 'None'    },
  { id: 'cap',        label: 'Cap'     },
  { id: 'sunglasses', label: 'Shades'  },
  { id: 'headphones', label: 'Phones'  },
  { id: 'crown',      label: 'Crown'   },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  shape:     'spray-can',
  color:     '#FF2D78',
  accessory: 'none',
};

// Slightly darker variant of a hex color
function dk(hex: string, amt = 40): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16)         - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff)        - amt);
  return `rgb(${r},${g},${b})`;
}

// ── Base shapes ───────────────────────────────────────────────────────────────

function SprayCan({ color }: { color: string }) {
  return (
    <g>
      {/* Nozzle stem */}
      <rect x="44" y="4"  width="12" height="14" rx="5" fill="#888" />
      <ellipse cx="50" cy="4" rx="8" ry="5" fill="#aaa" />
      {/* Cap */}
      <rect x="28" y="16" width="44" height="16" rx="8" fill={dk(color, 30)} />
      {/* Body */}
      <rect x="24" y="30" width="52" height="62" rx="12" fill={color} />
      {/* Shine strip */}
      <rect x="30" y="36" width="9"  height="50" rx="4"  fill="rgba(255,255,255,.22)" />
      {/* Label band */}
      <rect x="28" y="55" width="44" height="18" rx="3"  fill="rgba(255,255,255,.1)"  />
      {/* Bottom ring */}
      <rect x="24" y="84" width="52" height="8"  rx="6"  fill={dk(color, 20)} />
    </g>
  );
}

function Robot({ color }: { color: string }) {
  return (
    <g>
      {/* Antenna */}
      <rect x="45" y="4"  width="10" height="18" rx="4" fill={dk(color, 20)} />
      <circle cx="50" cy="3" r="5" fill="#00E5FF" />
      {/* Head */}
      <rect x="10" y="20" width="80" height="64" rx="14" fill={color} />
      {/* Left eye */}
      <rect x="16" y="34" width="28" height="20" rx="7"  fill="rgba(0,0,0,.45)" />
      <rect x="19" y="37" width="22" height="14" rx="5"  fill="#00E5FF" />
      <circle cx="35" cy="44" r="3" fill="rgba(255,255,255,.6)" />
      {/* Right eye */}
      <rect x="56" y="34" width="28" height="20" rx="7"  fill="rgba(0,0,0,.45)" />
      <rect x="59" y="37" width="22" height="14" rx="5"  fill="#FF2D78" />
      <circle cx="75" cy="44" r="3" fill="rgba(255,255,255,.6)" />
      {/* Speaker mouth */}
      <rect x="20" y="62" width="60" height="13" rx="6"  fill="rgba(0,0,0,.3)" />
      <rect x="25" y="65" width="7"  height="6"  rx="2"  fill="rgba(255,255,255,.3)" />
      <rect x="36" y="65" width="7"  height="6"  rx="2"  fill="rgba(255,255,255,.3)" />
      <rect x="47" y="65" width="7"  height="6"  rx="2"  fill="rgba(255,255,255,.3)" />
      <rect x="58" y="65" width="7"  height="6"  rx="2"  fill="rgba(255,255,255,.3)" />
      {/* Neck */}
      <rect x="38" y="82" width="24" height="14" rx="6" fill={color} />
    </g>
  );
}

function Alien({ color }: { color: string }) {
  return (
    <g>
      {/* Left antenna */}
      <line x1="34" y1="18" x2="24" y2="4" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="22" cy="3" r="5" fill="#00E5FF" />
      {/* Right antenna */}
      <line x1="66" y1="18" x2="76" y2="4" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="3" r="5" fill="#76FF03" />
      {/* Head oval */}
      <ellipse cx="50" cy="57" rx="42" ry="43" fill={color} />
      {/* Left eye */}
      <ellipse cx="30" cy="51" rx="17" ry="13" fill="rgba(0,0,0,.85)" />
      <ellipse cx="30" cy="51" rx="11" ry="9"  fill="#111" />
      <circle  cx="34" cy="46" r="4"           fill="rgba(255,255,255,.8)" />
      {/* Right eye */}
      <ellipse cx="70" cy="51" rx="17" ry="13" fill="rgba(0,0,0,.85)" />
      <ellipse cx="70" cy="51" rx="11" ry="9"  fill="#111" />
      <circle  cx="74" cy="46" r="4"           fill="rgba(255,255,255,.8)" />
      {/* Tiny mouth */}
      <path d="M 40 75 Q 50 83 60 75" fill="none" stroke="rgba(0,0,0,.45)"
            strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function CatShape({ color }: { color: string }) {
  return (
    <g>
      {/* Left ear */}
      <polygon points="10,48 24,8  44,48" fill={color} />
      <polygon points="17,46 24,16 38,46" fill="rgba(255,255,255,.28)" />
      {/* Right ear */}
      <polygon points="56,48 76,8  90,48" fill={color} />
      <polygon points="63,46 76,16 83,46" fill="rgba(255,255,255,.28)" />
      {/* Head */}
      <circle cx="50" cy="62" r="42" fill={color} />
      {/* Left eye */}
      <ellipse cx="33" cy="56" rx="12" ry="10" fill="rgba(0,0,0,.82)" />
      <circle  cx="33" cy="56" r="7"           fill="#1a1a1a" />
      <circle  cx="36" cy="53" r="2.8"          fill="rgba(255,255,255,.9)" />
      {/* Right eye */}
      <ellipse cx="67" cy="56" rx="12" ry="10" fill="rgba(0,0,0,.82)" />
      <circle  cx="67" cy="56" r="7"           fill="#1a1a1a" />
      <circle  cx="70" cy="53" r="2.8"          fill="rgba(255,255,255,.9)" />
      {/* Nose */}
      <polygon points="50,68 46,75 54,75" fill="rgba(255,140,170,.95)" />
      {/* Mouth */}
      <path d="M 46 75 Q 41 82 36 78" fill="none" stroke="rgba(0,0,0,.3)"
            strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 54 75 Q 59 82 64 78" fill="none" stroke="rgba(0,0,0,.3)"
            strokeWidth="1.8" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="4"  y1="67" x2="38" y2="69" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <line x1="4"  y1="73" x2="38" y2="73" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <line x1="4"  y1="79" x2="38" y2="77" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <line x1="62" y1="69" x2="96" y2="67" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <line x1="62" y1="73" x2="96" y2="73" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
      <line x1="62" y1="77" x2="96" y2="79" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
    </g>
  );
}

// ── Accessories ───────────────────────────────────────────────────────────────

function CapAcc({ color }: { color: string }) {
  return (
    <g>
      {/* Brim (backwards, sticks out left) */}
      <ellipse cx="24" cy="33" rx="20" ry="7" fill="#1a1a1a" />
      {/* Dome */}
      <ellipse cx="50" cy="23" rx="38" ry="17" fill="#2a2a2a" />
      <rect    x="12"  y="16" width="76" height="17" fill="#2a2a2a" />
      {/* Top button */}
      <circle cx="50" cy="8" r="5" fill="#333" />
      {/* Logo dot in player color */}
      <circle cx="60" cy="23" r="6" fill={color} />
      <circle cx="60" cy="23" r="3" fill="rgba(0,0,0,.4)" />
    </g>
  );
}

function SunglassesAcc({ color }: { color: string }) {
  return (
    <g>
      {/* Left lens */}
      <rect x="8"  y="42" width="34" height="22" rx="8" fill="rgba(0,0,0,.85)" />
      <rect x="10" y="44" width="10" height="8"  rx="3" fill="rgba(255,255,255,.12)" />
      {/* Bridge */}
      <rect x="42" y="50" width="16" height="4" rx="2" fill="#111" />
      {/* Right lens */}
      <rect x="58" y="42" width="34" height="22" rx="8" fill="rgba(0,0,0,.85)" />
      <rect x="60" y="44" width="10" height="8"  rx="3" fill="rgba(255,255,255,.12)" />
      {/* Temples in player color */}
      <rect x="2"  y="46" width="10" height="4" rx="2" fill={color} opacity="0.7" />
      <rect x="88" y="46" width="10" height="4" rx="2" fill={color} opacity="0.7" />
    </g>
  );
}

function HeadphonesAcc({ color }: { color: string }) {
  return (
    <g>
      {/* Arc band over head */}
      <path d="M 12 58 Q 12 6 50 6 Q 88 6 88 58"
            fill="none" stroke="#2a2a2a" strokeWidth="7" strokeLinecap="round" />
      {/* Left ear cup */}
      <rect x="2"  y="50" width="20" height="26" rx="8" fill="#333" />
      <rect x="6"  y="54" width="12" height="18" rx="5" fill={color} opacity="0.85" />
      {/* Right ear cup */}
      <rect x="78" y="50" width="20" height="26" rx="8" fill="#333" />
      <rect x="82" y="54" width="12" height="18" rx="5" fill={color} opacity="0.85" />
    </g>
  );
}

function CrownAcc({ color }: { color: string }) {
  return (
    <g>
      {/* Crown spikes */}
      <polygon points="14,26 22,4  30,26" fill="#FFD600" />
      <polygon points="32,26 42,8  52,26" fill="#FFD600" />
      <polygon points="50,26 60,4  70,26" fill="#FFD600" />
      <polygon points="70,26 78,8  86,26" fill="#FFD600" />
      {/* Crown band */}
      <rect x="14" y="22" width="72" height="20" rx="4" fill="#FFD600" />
      {/* Shine */}
      <rect x="14" y="22" width="72" height="7"  rx="4" fill="rgba(255,255,255,.22)" />
      {/* Gems in player color */}
      <circle cx="26" cy="34" r="5" fill={color} />
      <circle cx="50" cy="34" r="5" fill={color} />
      <circle cx="74" cy="34" r="5" fill={color} />
    </g>
  );
}

// ── Composition ───────────────────────────────────────────────────────────────

type P = { color: string };

const SHAPES: Record<AvatarShape, (p: P) => React.ReactElement> = {
  'spray-can': SprayCan,
  'robot':     Robot,
  'alien':     Alien,
  'cat':       CatShape,
};

const ACCESSORIES: Record<AvatarAccessory, ((p: P) => React.ReactElement) | null> = {
  'none':       null,
  'cap':        CapAcc,
  'sunglasses': SunglassesAcc,
  'headphones': HeadphonesAcc,
  'crown':      CrownAcc,
};

export function PlayerAvatar({
  config,
  size = 80,
}: {
  config: AvatarConfig;
  size?: number;
}) {
  const Shape = SHAPES[config.shape]  ?? SHAPES['spray-can'];
  const Acc   = ACCESSORIES[config.accessory] ?? null;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <Shape color={config.color} />
      {Acc && <Acc color={config.color} />}
    </svg>
  );
}
