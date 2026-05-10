import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "rgb(var(--bg) / <alpha-value>)",
        surface:  "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        border:   "rgb(var(--border) / <alpha-value>)",
        muted:    "rgb(var(--muted) / <alpha-value>)",
        fg:       "rgb(var(--fg) / <alpha-value>)",
        subtle:   "rgb(var(--subtle) / <alpha-value>)",
        brand:    "rgb(var(--brand) / <alpha-value>)",
        "brand-fg": "rgb(var(--brand-fg) / <alpha-value>)",
        danger:   "rgb(var(--danger) / <alpha-value>)",
        success:  "rgb(var(--success) / <alpha-value>)",
        warning:  "rgb(var(--warning) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter",
               "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        sm: "6px", md: "10px", lg: "14px", xl: "18px", "2xl": "22px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 1px 4px rgb(0 0 0 / 0.04)",
        pop:  "0 10px 30px -10px rgb(0 0 0 / 0.18), 0 4px 12px -4px rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
