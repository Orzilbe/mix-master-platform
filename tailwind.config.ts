import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "mm-bg":     "#0e0e0e",
        "mm-pink":   "#FF2D78",
        "mm-cyan":   "#00E5FF",
        "mm-green":  "#76FF03",
        "mm-orange": "#FF6D00",
        "mm-gold":   "#FFD700",
        "mm-surface":"#1a1a1a",
      },
      fontFamily: {
        marker: ["var(--font-marker)", "cursive"],
        boogaloo: ["var(--font-boogaloo)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
