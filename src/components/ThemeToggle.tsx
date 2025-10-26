"use client";

import {
  useEffect, useState
} from "react";
import {
  useTheme
} from "next-themes";
import {
  Moon, Sun
} from "lucide-react";

type Props = {
  className?: string
  iconClassName?: string
}

function ThemeToggle( {
  className = "", iconClassName = "h-5"
}: Props ) {
  const {
    resolvedTheme, setTheme
  } = useTheme();
  const [
    mounted,
    setMounted
  ] = useState( false );

  useEffect(
    () => setMounted( true ),
    [
    ]
  );

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme( isDark ? "light" : "dark" )}
      className={ className }
    >
      {!mounted ? (
        <span aria-hidden className="inline-block h-5 w-5" />
      ) : isDark ? (
        <Sun className={iconClassName} />
      ) : (
        <Moon className={iconClassName} />
      )}
    </button>
  );
}

export default ThemeToggle;