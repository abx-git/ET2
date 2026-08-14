import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Palette-Klassen leben in card-color.ts — ohne Scan fehlen sie im CSS
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        column: "var(--control)",
        panel: "var(--panel-solid)",
        ink: "var(--text)",
        muted: "var(--muted)",
        line: "var(--border)",
      },
    },
  },
  plugins: [],
};

export default config;
