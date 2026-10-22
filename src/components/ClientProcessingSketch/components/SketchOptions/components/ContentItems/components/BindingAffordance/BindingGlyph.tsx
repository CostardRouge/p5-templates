"use client";

import React from "react";
import clsx from "clsx";

/**
 * The modulation glyph: a keyframe-like diamond. Hollow when the field is free,
 * hollow with a centre dot when it is bound but nothing plays (muted, or
 * silenced by a solo elsewhere), filled with the iridescent drift when it is
 * driven. It replaced a pulsing pastille, which said "something moves" without
 * saying what — the value itself now moves on the field's own bar.
 */
export type BindingGlyphState = "free" | "muted" | "live";

export default function BindingGlyph( {
  state,
  className
}: {
  state: BindingGlyphState;
  className?: string;
} ) {
  return (
    <span
      aria-hidden
      className={ clsx(
        "relative grid h-3.5 w-3.5 shrink-0 place-items-center",
        className
      ) }
    >
      {state === "live" && (
        <span className="binding-diamond binding-iridescent absolute inset-[1.5px]" />
      )}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={ 2 }
        strokeLinejoin="round"
        className="relative h-full w-full"
      >
        <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
        {state === "muted" && (
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="currentColor"
            stroke="none"
          />
        )}
      </svg>
    </span>
  );
}
