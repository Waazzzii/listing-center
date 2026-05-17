import type { Config } from "tailwindcss";

/**
 * Wazzi Design System — Tailwind v3 configuration.
 * Tokens map to CSS variables defined in src/styles/globals.css.
 * Colors are stored as oklch() components without the function wrapper,
 * so we wrap them here. This mirrors the shadcn/ui pattern used in
 * Waazzzii/portfolio-center.
 */

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'oklch(var(--sidebar) / <alpha-value>)',
          foreground: 'oklch(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'oklch(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'oklch(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'oklch(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'oklch(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'oklch(var(--sidebar-border) / <alpha-value>)',
          ring: 'oklch(var(--sidebar-ring) / <alpha-value>)',
        },
        chart: {
          '1': 'oklch(var(--chart-1) / <alpha-value>)',
          '2': 'oklch(var(--chart-2) / <alpha-value>)',
          '3': 'oklch(var(--chart-3) / <alpha-value>)',
          '4': 'oklch(var(--chart-4) / <alpha-value>)',
          '5': 'oklch(var(--chart-5) / <alpha-value>)',
        },
        // Health bucket semantic colors (Listing Center specific)
        health: {
          red: 'oklch(var(--health-red) / <alpha-value>)',
          orange: 'oklch(var(--health-orange) / <alpha-value>)',
          yellow: 'oklch(var(--health-yellow) / <alpha-value>)',
          green: 'oklch(var(--health-green) / <alpha-value>)',
        },
        // Legacy compatibility — point old class names to new tokens.
        // Remove these once every component has been migrated.
        casago: {
          blue: 'oklch(var(--primary) / <alpha-value>)',
          'blue-light': 'oklch(var(--accent) / <alpha-value>)',
          'blue-dark': 'oklch(var(--primary) / <alpha-value>)',
          orange: 'oklch(var(--chart-1) / <alpha-value>)',
          'orange-light': 'oklch(var(--chart-1) / <alpha-value>)',
          'orange-dark': 'oklch(var(--chart-1) / <alpha-value>)',
          'gray-light': 'oklch(var(--muted-foreground) / <alpha-value>)',
          'gray-mid': 'oklch(var(--muted-foreground) / <alpha-value>)',
          'gray-dark': 'oklch(var(--muted-foreground) / <alpha-value>)',
        },
        'health-red': 'oklch(var(--health-red) / <alpha-value>)',
        'health-orange': 'oklch(var(--health-orange) / <alpha-value>)',
        'health-yellow': 'oklch(var(--health-yellow) / <alpha-value>)',
        'health-green': 'oklch(var(--health-green) / <alpha-value>)',
        'health-blue': 'oklch(var(--chart-2) / <alpha-value>)',
        'lc-primary': 'oklch(var(--primary) / <alpha-value>)',
        'lc-surface': 'oklch(var(--background) / <alpha-value>)',
        'lc-border': 'oklch(var(--border) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
