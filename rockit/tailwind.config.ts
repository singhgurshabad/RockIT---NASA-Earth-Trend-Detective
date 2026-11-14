import type { Config } from "tailwindcss";

// Colors live as CSS variables in app/globals.css (so dark mode is one place).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--bg)",
        sky: "var(--sky)",
        ink: "var(--ink)",
        btn: "var(--btn)",
        "btn-hover": "var(--btn-hover)",
        card: "var(--card)",
        line: "var(--line)",
        gridbg: "var(--grid)",
      },
      fontFamily: { serif: ['Georgia', '"Times New Roman"', "serif"] },
    },
  },
  plugins: [],
};
export default config;
