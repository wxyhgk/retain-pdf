/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f1e8",
        paper: "#fffdf8",
        ink: "#1d1d1b",
        muted: "#70685b",
        line: "#d9d0c2",
        accent: "#1c5d52",
        "accent-weak": "#d7ebe6",
        danger: "#a12626",
        "danger-weak": "#f8e1e1",
        ok: "#1b6f3a",
        "ok-weak": "#dff3e6",
        warn: "#8a5a00",
        "warn-weak": "#f8e8c8",
      },
      fontFamily: {
        sans: ['"Noto Sans CJK SC"', '"Source Han Sans SC"', "sans-serif"],
        serif: ['"Noto Serif CJK SC"', '"Source Han Serif SC"', "serif"],
        mono: ['"Iosevka"', '"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(80, 66, 40, 0.08)",
        panel: "0 18px 48px rgba(37, 31, 20, 0.22)",
      },
    },
  },
  plugins: [],
};
