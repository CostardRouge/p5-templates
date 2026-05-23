"use client";

import clsx from "clsx";
import {
  ArrowUp
} from "lucide-react";
import {
  useCallback, useEffect, useState
} from "react";

function getScrollContainer(): HTMLElement | null {
  if ( typeof document === "undefined" ) {
    return null;
  }

  return document.querySelector( "main" );
}

export default function ScrollToTopButton() {
  const [
    show,
    setShow
  ] = useState( false );

  useEffect(
    () => {
      const el = getScrollContainer();

      if ( !el ) {
        return;
      }

      const update = () => {
        const threshold = Math.max(
          window.innerHeight * 0.8,
          400
        );

        setShow( el.scrollTop > threshold );
      };

      update();
      el.addEventListener(
        "scroll",
        update,
        {
          passive: true
        }
      );

      return () => el.removeEventListener(
        "scroll",
        update
      );
    },
    []
  );

  const handleClick = useCallback(
    () => {
      const el = getScrollContainer();

      el?.scrollTo( {
        top: 0,
        behavior: "smooth"
      } );
    },
    []
  );

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={ handleClick }
      className={ clsx(
        "fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40",
        "h-10 w-10 rounded-full bg-foreground text-background",
        "border border-border shadow-lg",
        "inline-flex items-center justify-center",
        "transition-all duration-200 hover:scale-105 active:scale-95",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      ) }
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
