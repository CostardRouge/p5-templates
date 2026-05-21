import type {
  Config
} from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
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
        "progress-end": "hsl(var(--progress-end))"
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
          }
        },
        "pulse-soft": {
          "0%, 100%": {
            opacity: "1"
          },
          "50%": {
            opacity: "0.6"
          }
        },
        slideInFromTop: {
          "0%": {
            opacity: "0",
            transform: "translateY(-20px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        highlightFade: {
          "0%": {
            backgroundColor: "hsl(var(--focus) / 0.2)"
          },
          "100%": {
            backgroundColor: "transparent"
          }
        },
        "gradient-shift": {
          "0%, 100%": {
            "background-position": "0% 50%"
          },
          "50%": {
            "background-position": "100% 50%"
          }
        },
        marquee: {
          "0%": {
            transform: "translateX(0)"
          },
          "100%": {
            transform: "translateX(-50%)"
          }
        },
        "marquee-reverse": {
          "0%": {
            transform: "translateX(-50%)"
          },
          "100%": {
            transform: "translateX(0)"
          }
        },
        float: {
          "0%, 100%": {
            transform: "translateY(0) rotate(0deg)"
          },
          "50%": {
            transform: "translateY(-20px) rotate(3deg)"
          }
        },
        blob: {
          "0%, 100%": {
            transform: "translate(0, 0) scale(1)"
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)"
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)"
          }
        },
        "reveal-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(40px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "marquee-hover": {
          "0%, 10%": {
            transform: "translateX(0)"
          },
          "45%, 55%": {
            transform: "translateX(var(--marquee-dx, 0))"
          },
          "90%, 100%": {
            transform: "translateX(0)"
          }
        }
      },
      animation: {
        "pulse-soft": "pulse-soft 1.5s ease-in-out infinite",
        slideInFromTop: "slideInFromTop 0.5s ease-out",
        highlightFade: "highlightFade 1s ease-out",
        "gradient-shift": "gradient-shift 8s ease-in-out infinite",
        marquee: "marquee 30s linear infinite",
        "marquee-slow": "marquee 60s linear infinite",
        "marquee-reverse": "marquee-reverse 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        blob: "blob 14s ease-in-out infinite",
        "reveal-up": "reveal-up 0.8s ease-out both",
        "marquee-hover": "marquee-hover var(--marquee-duration, 6s) ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
