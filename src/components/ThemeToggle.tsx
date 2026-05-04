"use client";

import {
  useEffect, useState, useRef
} from "react";
import {
  useTheme
} from "next-themes";
import {
  Moon, Sun, Monitor, Check
} from "lucide-react";

type Props = {
  className?: string;
  iconClassName?: string;
};

function ThemeToggle( {
  className = "", iconClassName = "h-5"
}: Props ) {
  const {
    theme, setTheme, resolvedTheme
  } = useTheme();
  const [
    mounted,
    setMounted
  ] = useState( false );
  const [
    isOpen,
    setIsOpen
  ] = useState( false );
  const menuRef = useRef<HTMLDivElement>( null );

  useEffect(
    () => setMounted( true ),
    []
  );

  useEffect(
    () => {
      const handleClickOutside = ( event: MouseEvent ) => {
        if ( menuRef.current && !menuRef.current.contains( event.target as Node ) ) {
          setIsOpen( false );
        }
      };

      if ( isOpen ) {
        document.addEventListener(
          "mousedown",
          handleClickOutside
        );
      }

      return () => {
        document.removeEventListener(
          "mousedown",
          handleClickOutside
        );
      };
    },
    [
      isOpen
    ]
  );

  const isDark = mounted && resolvedTheme === "dark";

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: Sun
    },
    {
      value: "dark",
      label: "Dark",
      icon: Moon
    },
    {
      value: "system",
      label: "System",
      icon: Monitor
    }
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-label="Toggle theme"
        title="Toggle theme"
        onClick={() => setIsOpen( !isOpen )}
        className={className}
      >
        {!mounted ? (
          <span aria-hidden className="inline-block h-5 w-5" />
        ) : isDark ? (
          <Sun className={iconClassName} />
        ) : (
          <Moon className={iconClassName} />
        )}
      </button>

      {mounted && isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-40 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
          {themeOptions.map( ( {
            value, label, icon: Icon
          } ) => (
            <button
              key={value}
              onClick={() => {
                setTheme( value );
                setIsOpen( false );
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-hover transition-colors text-left"
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              {theme === value && <Check className="w-4 h-4" />}
            </button>
          ) )}
        </div>
      )}
    </div>
  );
}

export default ThemeToggle;
