import type { Config } from "tailwindcss";

// Colours live as CSS variables in app/globals.css, so the palette is defined in one place.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        deep: "var(--deep)",
        panel: "var(--panel)",
        raised: "var(--raised)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        review: "var(--review)",
      },
      fontFamily: {
        sans: ['"Archivo Variable"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      maxWidth: { page: "1280px" },
    },
  },
  plugins: [],
};
export default config;
