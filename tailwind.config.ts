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
      },
    },
  },
  plugins: [
  ],
} satisfies Config;
