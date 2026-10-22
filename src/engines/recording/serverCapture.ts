import {
  resolveAnimation, totalFramesFor
} from "@/lib/animationConfig";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import {
  getSketchOptions
} from "@/lib/syncSketchOptions";

import type {
  CaptureTiming, ServerCaptureController
} from "./types";

/**
 * Shared registry for the headless (Playwright) capture controller.
 *
 * Each engine registers a `ServerCaptureController` once it is ready; the
 * server-side recording pipeline reads it from `window.__sketchCapture` and
 * drives every engine through the same protocol (`prepare()` then
 * `renderFrame(i)` per frame, then a canvas read or DOM screenshot).
 *
 * Kept engine-agnostic so it can be imported from every engine
 * implementation without duplicating the window plumbing.
 */
declare global {
  interface Window {
    __sketchCapture?: ServerCaptureController;
  }
}

/**
 * The clock a frame index is counted in, for `options` on `slideIndex`
 * (global settings when undefined) — the same resolution the recorders use
 * (`BaseSketchEngine.getFrameRate` / `getTotalFrames`).
 */
export function captureTiming(
  options: Record<string, any>,
  slideIndex?: number
): CaptureTiming {
  const {
    animation
  } = getEffectiveSlideSettings(
    options,
    slideIndex
  );
  const {
    framerate, duration
  } = resolveAnimation( animation );

  return {
    frameRate: framerate,
    duration,
    totalFrames: totalFramesFor( animation )
  };
}

function currentSlideIndex(): number | undefined {
  const index = window.getCurrentSlide?.()?.index;

  return typeof index === "number" ? index : undefined;
}

export function registerServerCaptureController( controller: ServerCaptureController ): void {
  if ( typeof window === "undefined" ) {
    return;
  }

  window.__sketchCapture = {
    timing: () => captureTiming(
      getSketchOptions(),
      currentSlideIndex()
    ),
    ...controller
  };
}

export function unregisterServerCaptureController(): void {
  if ( typeof window === "undefined" ) {
    return;
  }

  delete window.__sketchCapture;
}
