/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Frutiger Aero palette */
        aero: {
          "sky-blue": "#0689E4",
          "deep-blue": "#0032DB",
          "bright-cyan": "#00B2FF",
          "leaf-green": "#71AB23",
          "bright-lime": "#9FE11D",
          "clean-white": "#FFFFFF",
          "golden": "#FBB905",
          "burnt-orange": "#D55E0F",
          "periwinkle": "#D9E3F0",
          "ocean-blue": "#0079BF",
          "light-blue": "#38ABE4",
          "mid-blue": "#84CDEC",
          "ice-blue": "#C9EEFF",
          "frost": "#D9F0F6",
          "soft-blue": "#7DA4E8",
          /* Backward compat with old aero.* names */
          bondi: "hsl(var(--aero-bondi))",
          tangerine: "hsl(var(--aero-tangerine))",
          grape: "hsl(var(--aero-grape))",
          lime: "hsl(var(--aero-lime-hsl))",
          strawberry: "hsl(var(--aero-strawberry))",
          sky: "hsl(var(--aero-sky))",
          aqua: "hsl(var(--aero-aqua))",
          silver: "hsl(var(--aero-silver))",
          glass: "hsl(var(--aero-glass))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      keyframes: {
        "record-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "aero-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "aero-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(6, 137, 228, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(6, 137, 228, 0.5)" },
        },
      },
      animation: {
        "record-pulse": "record-pulse 2s ease-in-out infinite",
        "fade-in": "fade-in 0.4s ease-in-out",
        "aero-shimmer": "aero-shimmer 3s ease-in-out infinite",
        "aero-pulse": "aero-pulse 2s ease-in-out infinite",
      },
      backdropBlur: {
        glass: "20px",
        "glass-heavy": "24px",
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0, 60, 120, 0.12), 0 1px 4px rgba(0, 60, 120, 0.06)",
        "glass-elevated": "0 8px 40px rgba(0, 60, 120, 0.18), 0 2px 8px rgba(0, 60, 120, 0.08)",
        "aero-inset": "inset 0 1px 0 rgba(255, 255, 255, 0.5)",
        "aero-glow": "0 0 12px rgba(6, 137, 228, 0.25)",
        "aero-button": "0 1px 3px rgba(0, 60, 120, 0.3), 0 4px 12px rgba(0, 60, 120, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.45)",
      },
    },
  },
  plugins: [],
};
