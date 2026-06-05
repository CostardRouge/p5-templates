"use client";
import {
  useMemo
} from "react";

import {
  computeVideoPhase, type VideoParams
} from "./types";

type Props = {
  params: VideoParams;
  width?: number;
  height?: number;
  samples?: number;
};

/**
 * Plots `videoPhase(p)` for p ∈ [0, 1] so the user sees how repeat /
 * speed / offset / loopMode combine into the actual playback curve.
 * The X axis is sketch progression, Y is the normalized video time.
 *
 * Rendered as SVG (not canvas) on purpose: the stroke uses `currentColor`,
 * which inherits the theme's `--foreground` via the `text-foreground` class.
 * That keeps the curve readable in both light and dark themes — and flips
 * automatically when the theme changes — with zero JS theme logic. (A canvas
 * 2D context silently ignores `currentColor`, falling back to black, which
 * is why the curve used to disappear on the dark theme.)
 */
export default function MiniTimeline( {
  params,
  width = 220,
  height = 56,
  samples = 200
}: Props ) {
  const points = useMemo(
    () => {
      const coords: string[] = [];

      for ( let i = 0; i <= samples; i++ ) {
        const p = i / samples;
        const phase = computeVideoPhase(
          p,
          params
        );
        const x = p * ( width - 2 ) + 1;
        const y = ( 1 - phase ) * ( height - 2 ) + 1;

        coords.push( `${ x.toFixed( 2 ) },${ y.toFixed( 2 ) }` );
      }

      return coords.join( " " );
    },
    [
      params,
      width,
      height,
      samples
    ]
  );

  return (
    <svg
      width={ width }
      height={ height }
      viewBox={ `0 0 ${ width } ${ height }` }
      className="text-foreground block"
      role="img"
      aria-label="Video time mapping preview"
    >
      {/* Frame: muted version of the same theme colour. */}
      <rect
        x={ 0.5 }
        y={ 0.5 }
        width={ width - 1 }
        height={ height - 1 }
        fill="none"
        stroke="currentColor"
        strokeOpacity={ 0.3 }
        strokeWidth={ 1 }
      />
      {/* Curve: full-strength theme foreground. */}
      <polyline
        points={ points }
        fill="none"
        stroke="currentColor"
        strokeWidth={ 1.25 }
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
