import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        brand: {
          "instagram-start": "hsl(var(--instagram-start))",
          "instagram-middle": "hsl(var(--instagram-middle))",
          "instagram-end": "hsl(var(--instagram-end))",
          line: "hsl(var(--line-brand))",
        },
      },
      // サイト全体の角丸スケール（詳細は globals.css の --radius 定義そばのコメントを参照）。
      // sm(8px) < md(10px) < lg(14px=--radius) < xl(20px) < 2xl(26px)。
      // 独自の rounded-[Npx] は使わず、必ずこのいずれかを使うこと。
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-jp)", "var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 8px 20px -4px rgb(0 0 0 / 0.10), 0 3px 8px -3px rgb(0 0 0 / 0.06)",
        elevated: "0 12px 32px -8px rgb(0 0 0 / 0.16), 0 4px 12px -4px rgb(0 0 0 / 0.08)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.08), 0 8px 24px -6px hsl(var(--primary) / 0.18)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "heart-pop": {
          "0%": { opacity: "0", transform: "scale(0.4)" },
          "22%": { opacity: "1", transform: "scale(1.15)" },
          "40%": { transform: "scale(1)" },
          "80%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.05)" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "pop-in": "pop-in 140ms cubic-bezier(0.34,1.56,0.64,1)",
        "heart-pop": "heart-pop 750ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
