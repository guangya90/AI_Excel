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
        primary: {
          DEFAULT: "#0fc6c2",
          dark: "#0bada9",
          light: "#e8fafa",
          muted: "#b5e8e8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
