"use client";

import React from "react";

/**
 * Pure-CSS VU meter. Reads a channel CSS custom property (written every frame
 * by the channel bridge on `:root`) and renders a fill — no React state, no
 * re-renders. `orientation="dot"` renders a 2D activity dot for vector2d
 * sources using the `-x` / `-y` vars derived from `varName`'s channel.
 */
export default function ChannelMeter( {
  varName,
  className = "",
  orientation = "bar"
}: {
  varName: string;
  className?: string;
  orientation?: "bar" | "dot";
} ) {
  if ( orientation === "dot" ) {
    // varName is like "--ch-mouse-mag"; derive the channel's x/y vars.
    const base = varName.replace(
      /-(mag|angle|x|y)$/,
      ""
    );

    return (
      <span
        className={ `relative inline-block h-8 w-8 rounded-md border border-theme bg-background overflow-hidden ${ className }` }
      >
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
          style={ {
            left: `calc(var(${ base }-x, 0.5) * 100%)`,
            top: `calc(var(${ base }-y, 0.5) * 100%)`
          } }
        />
      </span>
    );
  }

  return (
    <span
      className={ `relative block h-1.5 w-full overflow-hidden rounded-full bg-foreground/10 ${ className }` }
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
        style={ {
          width: `calc(var(${ varName }, 0) * 100%)`
        } }
      />
    </span>
  );
}
