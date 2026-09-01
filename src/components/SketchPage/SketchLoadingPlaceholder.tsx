"use client";

import React, {
  useCallback
} from "react";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import type {
  LoadingProgressSnapshot
} from "@/lib/assets/loadingProgress";

type SketchLoadingPlaceholderProps = {
  thumbnailUrl: string;
  name: string;
  engineId: string;
  progress: LoadingProgressSnapshot | null;
  /** Sketch output size, used to reserve the poster's box before it decodes. */
  size?: { width?: number;
    height?: number };
};

/**
 * The sketch page's loading screen: the poster doubles as the progress
 * surface, revealed left-to-right as assets land, with a hairline fill riding
 * its bottom edge and one caption naming what is currently in flight.
 *
 * **The poster must never move.** Its height is defined by the base `<img>`
 * alone; the reveal layer, the edge bar and the caption are all positioned out
 * of flow, and the caption sits in a fixed-height slot. That is what stops the
 * telemetry re-centring the stack and nudging the thumbnail every time a line
 * appears or a step settles — the bug this component was extracted to fix.
 */
export default function SketchLoadingPlaceholder( {
  thumbnailUrl,
  name,
  engineId,
  progress,
  size
}: SketchLoadingPlaceholderProps ) {
  // Reserve the poster's height from the sketch's own aspect ratio. Without
  // this the box is sized by the thumbnail, so it is 0px tall until that image
  // decodes and then snaps to full height — a shift of the very element this
  // component exists to hold still. The thumbnail is a render of the sketch,
  // so its ratio is the sketch's; `object-cover` absorbs any mismatch.
  const aspectRatio = size?.width && size?.height
    ? `${ size.width } / ${ size.height }`
    : "1080 / 1350";

  const percentage = Math.round( ( progress?.progress ?? 0 ) * 100 );

  // Nothing planned yet: pulse the bar instead of implying a real measurement.
  const indeterminate = !progress || progress.total === 0;

  // Two fills, one target: the poster reveal and the edge bar advance together.
  // Tweened off a rAF loop rather than a CSS transition because snapshot bursts
  // collapsed by React batching would otherwise land as visible jumps.
  //
  // Disabled while indeterminate: the loop writes `style.width` every frame and
  // would immediately overwrite the full-width inline style the pulsing bar
  // needs. Re-enabling restarts the tween from 0, which is the wanted ramp.
  const revealRef = useSmoothFill<HTMLDivElement>(
    !indeterminate,
    percentage
  );
  const edgeRef = useSmoothFill<HTMLDivElement>(
    !indeterminate,
    percentage
  );

  const pendingStep = progress?.steps.find( ( step ) => step.status === "pending" );
  const caption = pendingStep
    ? `${ pendingStep.kind } · ${ pendingStep.label }`
    : `loading ${ name }`;

  // Both copies of the poster need the same fallback, or the reveal layer keeps
  // showing a broken image after the base has already swapped to the fallback.
  const handleError = useCallback(
    ( event: React.SyntheticEvent<HTMLImageElement> ) => {
      const fallback = getSketchThumbnailURL(
        engineId,
        name
      );

      if ( event.currentTarget.src !== window.location.origin + fallback ) {
        event.currentTarget.src = fallback;
      }
    },
    [
      engineId,
      name
    ]
  );

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      role="progressbar"
      aria-label={ `Loading ${ name }` }
      aria-valuenow={ indeterminate ? undefined : percentage }
      aria-valuemin={ 0 }
      aria-valuemax={ 100 }
    >
      <div
        className="relative w-60 rounded-lg shadow-lg"
        style={ {
          aspectRatio
        } }
      >
        {/* Base layer. The box's height comes from the aspect ratio above, not
            from this image, so it is correct before the thumbnail decodes. */}
        <img
          data-pin-nopin="true"
          src={ thumbnailUrl }
          alt={ `${ name } thumbnail` }
          className="block w-full h-full object-cover rounded-lg opacity-30 grayscale"
          onError={ handleError }
        />

        {/* Reveal layer: a full-strength copy clipped to the progress width. */}
        <div
          ref={ revealRef }
          aria-hidden="true"
          // Stable hook for the headless layout check, which asserts the
          // poster never moves and this width never decreases.
          data-loading-reveal=""
          className="absolute inset-y-0 left-0 overflow-hidden rounded-lg"
          style={ {
            width: "0%"
          } }
        >
          <img
            data-pin-nopin="true"
            src={ thumbnailUrl }
            alt=""
            // Fixed width, NOT `w-full`: inside the clipping wrapper a relative
            // width would squash the image as the wrapper grows instead of
            // revealing successive slices of it.
            className="block w-60 max-w-none h-full object-cover rounded-lg"
            onError={ handleError }
          />
        </div>

        {/* Edge bar, inside the poster's rounded bottom corners.
            It sits on top of the artwork, so it cannot use the
            --progress-start/end ramp the rest of the app uses: those greys are
            tuned against the page background and vanish over a photograph. A
            translucent scrim plus a foreground-toned fill keeps it readable on
            any thumbnail, in either theme. */}
        <div className="absolute inset-x-0 bottom-0 h-1 rounded-b-lg overflow-hidden bg-background/60">
          <div
            ref={ edgeRef }
            data-loading-fill=""
            className={ `h-full bg-foreground/85${
              indeterminate ? " animate-pulse-soft" : "" }` }
            style={ {
              width: indeterminate ? "100%" : "0%"
            } }
          />
        </div>

        {/* Caption in a fixed-height slot: the text can change on every
            snapshot without ever changing the layout around it. */}
        <div className="absolute top-full inset-x-0 mt-4 h-4 flex items-center justify-center overflow-hidden">
          <p className="text-[11px] leading-4 text-label truncate max-w-full">
            {caption}
          </p>
        </div>
      </div>
    </div>
  );
}
