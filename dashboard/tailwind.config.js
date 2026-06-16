/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: "#0f172a",
        slate: "#1e293b",
        indigo: { DEFAULT: "#6366f1", light: "#a5b4fc" },
        muted: "#94a3b8",
      },
    },
  },
  plugins: [],
};
