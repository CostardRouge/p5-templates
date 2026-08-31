"use client";

import {
  Minimize
} from "lucide-react";
import {
  useEffect, useState
} from "react";
import clsx from "clsx";
import {
  exitPresentation
} from "@/lib/presentation/presentationMode";

// Long enough to find with a mouse, short enough that an unattended display
// settles into just the sketch.
const IDLE_FADE_MS = 2000;

/**
 * The single way out of a presentation, in every layout.
 *
 * Esc is free only while the Fullscreen API is engaged — "Fill the page" and
 * "Clean preview" hide the whole interface without it, so without this pill
 * (and the Escape handler in SketchPage) they would be a trap. It fades when
 * the pointer rests so an expo display reads as the sketch alone, and comes
 * back on the first movement.
 */
export default function PresentationExitButton() {
  const [
    visible,
    setVisible
  ] = useState( true );

  useEffect(
    () => {
      let timer: ReturnType<typeof setTimeout>;

      const wake = () => {
        setVisible( true );
        clearTimeout( timer );
        timer = setTimeout(
          () => setVisible( false ),
          IDLE_FADE_MS
        );
      };

      wake();
      window.addEventListener(
        "pointermove",
        wake
      );
      window.addEventListener(
        "keydown",
        wake
      );

      return () => {
        clearTimeout( timer );
        window.removeEventListener(
          "pointermove",
          wake
        );
        window.removeEventListener(
          "keydown",
          wake
        );
      };
    },
    []
  );

  return (
    <button
      onClick={ () => exitPresentation() }
      title="Exit presentation (Esc)"
      aria-label="Exit presentation"
      className={ clsx(
        "absolute top-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-1.5 h-9 px-3",
        "bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md",
        "text-foreground/70 hover:text-foreground hover:bg-hover transition-all duration-300",
        // Kept mounted while faded so the pointer-move that reveals it does not
        // also have to hit a freshly mounted button.
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      ) }
    >
      <Minimize className="w-4 h-4" />
      <span className="text-xs font-semibold">Exit presentation</span>
    </button>
  );
}
