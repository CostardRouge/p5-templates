import type {
  Config
} from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: [
    "class",
    "[data-theme=\"dark\"]"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        theme: "hsl(var(--border))",
        hover: "hsl(var(--hover) / <alpha-value>)",
        active: "hsl(var(--active) / <alpha-value>)",
        focus: "hsl(var(--focus) / <alpha-value>)",
        label: "hsl(var(--label))",
        "progress-start": "hsl(var(--progress-start))",
        "progress-end": "hsl(var(--progress-end))",
      },
      keyframes: {
        "cycle-align": {
          "0%": {
            "text-align": "left"
          },
          "25%": {
            "text-align": "center"
          },
          "50%": {
            "text-align": "right"
          },
          "75%": {
            "text-align": "center"
          },
          "100%": {
            "text-align": "left"
          },
        },
        "pulse-soft": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.6",
          },
        },
        slideInFromTop: {
          "0%": {
            opacity: "0",
            transform: "translateY(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        highlightFade: {
          "0%": {
            backgroundColor: "hsl(var(--focus) / 0.2)",
          },
          "100%": {
            backgroundColor: "transparent",
          },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite",
        slideInFromTop: "slideInFromTop 0.5s ease-out",
        highlightFade: "highlightFade 1s ease-out",
      },
    },
  },
  plugins: [
  ],
} satisfies Config;
