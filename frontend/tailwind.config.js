/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          bg: "#0B0E14",
          panel: "#12161F",
          line: "#1E2430",
        },
        stat: {
          accent: "#F97316",
          positive: "#22C55E",
          negative: "#EF4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
