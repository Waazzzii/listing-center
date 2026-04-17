import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--text-primary)",
        casago: {
          blue: '#0092D3',
          'blue-light': '#33A8DE',
          'blue-dark': '#0078AD',
          orange: '#F57000',
          'orange-light': '#FF8A2E',
          'orange-dark': '#CC5D00',
          'gray-light': '#B8B3AD',
          'gray-mid': '#B7B9BF',
          'gray-dark': '#969491',
        },
        "health-red": "#EF4444",
        "health-orange": "#F97316",
        "health-yellow": "#EAB308",
        "health-green": "#22C55E",
        "health-blue": "#3B82F6",
        "lc-primary": "var(--primary)",
        "lc-surface": "var(--surface)",
        "lc-border": "var(--border)",
      },
    },
  },
  plugins: [],
};
export default config;
