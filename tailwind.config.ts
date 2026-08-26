import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: "#0E7C5A",
          dark: "#0A5F45",
          light: "#E4F3EC",
        },
        ink: "#0B1220",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "var(--font-tajawal)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        display: [
          "var(--font-space-grotesk)",
          "var(--font-geist-sans)",
          "var(--font-tajawal)",
          "ui-sans-serif",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
