import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0c0f14",
        foreground: "#f3f4f6",
        surface: {
          50: "#181d24",
          100: "#13171d",
          200: "#0e1116",
          300: "#090c0f",
        },
        whatsapp: {
          light: "#25D366",
          DEFAULT: "#128C7E",
          dark: "#075E54",
          teal: "#00a884",
          badge: "#00a884",
          chatbg: "#0b141a",
          bubbleIn: "#202c33",
          bubbleOut: "#005c4b",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 20px -5px rgba(37, 211, 102, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
