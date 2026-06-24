/**
 * Single source of truth for animation duration / framerate resolution.
 *
 * Before this module, the same two numbers were defaulted in at least four
 * different places with three different fallbacks:
 *
 *   - the server encode loop          → `duration || 5`   (recordSketch.ts)
 *   - the in-page p5 recording clock   → `duration || 10`  (time.js / sketch.js)
 *   - the engines / effective settings → `duration ?? 12`
 *   - the progression bar              → `duration ?? 10`  (Math.floor)
 *
 * They only agreed when `duration` was a present, positive number. The instant
 * it was absent or `0` (the duration slider used to allow `0`), the server
 * encoded `round(5 * fps)` frames while the clock looped over a 10- or
 * 12-second window — so the recording was a fixed wrong length whose animation
 * was cut off partway and never closed the loop. Changing the slider appeared
 * to "do nothing" because the value the server read was never the slider's.
 *
 * Every consumer that needs a frame count or a clock denominator must now go
 * through `resolveAnimation` / `totalFramesFor`, so the encoded frame count and
 * the sketch clock can never derive duration from different defaults. The
 * `> 0` guards (not `||`) also mean a falsy-but-explicit `0` clamps to the
 * shared default instead of silently substituting a *different* default for a
 * value the user typed.
 *
 * Kept dependency-free and isomorphic so both the browser sketch runtimes
 * (p5 `time.js`/`sketch.js`, the GSAP runtime) and the Node recording pipeline
 * import the exact same logic.
 */

/** The canonical default loop length, in seconds. Matches `SketchAnimationSchema`. */
export const DURATION_DEFAULT = 12;

/** The canonical default framerate, in fps. Matches `SketchAnimationSchema`. */
export const FRAMERATE_DEFAULT = 60;

export type ResolvedAnimation = {
  duration: number;
  framerate: number;
};

type AnimationLike =
  | {
    duration?: unknown;
    framerate?: unknown;
  }
  | null
  | undefined;

/** Coerce a value to a positive finite number, or fall back to `fallback`. */
function positiveOr(
  value: unknown,
  fallback: number
): number {
  const numeric = typeof value === "number" ? value : Number( value );

  return Number.isFinite( numeric ) && numeric > 0 ? numeric : fallback;
}

/**
 * Resolve an `{ duration, framerate }` block to safe, positive numbers.
 *
 * Accepts partial / missing / string / zero / NaN inputs (imported options,
 * a persisted job, a slider dragged to its edge) and always returns usable
 * values. A present, positive number is returned as-is (coerced from string);
 * anything else becomes the shared default.
 */
export function resolveAnimation( animation?: AnimationLike ): ResolvedAnimation {
  return {
    duration: positiveOr(
      animation?.duration,
      DURATION_DEFAULT
    ),
    framerate: positiveOr(
      animation?.framerate,
      FRAMERATE_DEFAULT
    )
  };
}

/**
 * The number of frames in exactly one loop of the given animation.
 *
 * This is THE definition of a recording's length: every encoder loop (browser
 * and server) and the clock's progression denominator are derived from it, so
 * they cannot disagree. Always `>= 1` so a degenerate config never produces a
 * zero-frame (empty) recording.
 */
export function totalFramesFor( animation?: AnimationLike ): number {
  const {
    duration,
    framerate
  } = resolveAnimation( animation );

  return Math.max(
    1,
    Math.round( duration * framerate )
  );
}
