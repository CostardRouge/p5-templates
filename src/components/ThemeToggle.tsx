"use client";
import {
  useState, useEffect
} from "react";
import {
  Sun, Moon
} from "lucide-react";

export function ThemeToggle() {
  const [
    theme,
    setTheme
  ] = useState<"light" | "dark">( "light" );

  useEffect(
    () => {
      const stored = localStorage.getItem( "theme" );

      if ( stored === "light" || stored === "dark" ) setTheme( stored );
      else setTheme( window.matchMedia( "(prefers-color-scheme: dark)" ).matches ? "dark" : "light" );
    },
    [
    ]
  );

  useEffect(
    () => {
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark"
      );
      localStorage.setItem(
        "theme",
        theme
      );
    },
    [
      theme
    ]
  );
  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme( theme === "dark" ? "light" : "dark" )}
      className="mb-4 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 self-end"
    >
      {theme === "dark" ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
    </button>
  );
}