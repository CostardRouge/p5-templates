/**
 * Engine-agnostic helper that resolves the *effective* size and animation
 * for a given slide.  Per-slide overrides win; otherwise the global value
 * is used as the fallback.
 *
 * This module is the SINGLE SOURCE OF TRUTH for resolving a sketch's
 * effective duration + framerate. Both rendering engines (`P5Engine`,
 * `GsapEngine`), the browser recorder and the server recorder
 * (`recordSketch`) resolve through here so the preview, the front (browser)
 * recording and the back (server) recording always agree on how long a clip
 * is and how many frames it contains. Divergent ad-hoc fallbacks (the old
 * `duration || 5` in the server path vs `|| 10` in the p5 clock vs `12` in
 * the schema) were exactly what made "the duration setting doesn't work"
 * reproduce in recordings — keep every default flowing from the constants
 * below.
 */

type Size = { width: number;
  height: number };
type Animation = { framerate: number;
  duration: number };

export type EffectiveSlideSettings = {
  size: Size;
  animation: Animation;
};

/** Canonical defaults — mirror the Zod schema defaults in sketch.types.ts. */
export const DEFAULT_DURATION = 12;
export const DEFAULT_FRAMERATE = 60;
export const DEFAULT_WIDTH = 1080;
export const DEFAULT_HEIGHT = 1350;

const DEFAULTS: EffectiveSlideSettings = {
  size: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT
  },
  animation: {
    framerate: DEFAULT_FRAMERATE,
    duration: DEFAULT_DURATION
  }
};

/**
 * Coerce a possibly-stringy / missing / out-of-range value to a finite,
 * positive number, falling back to `fallback`. Persisted jobs and imported
 * option files routinely carry numbers as strings (`"30"`) or, for a
 * duration dragged to the slider floor, `0` — both of which would otherwise
 * poison `duration * framerate` (NaN / 0 frames) and silently break the
 * recording. Centralising the coercion keeps every consumer robust.
 */
function toPositiveNumber(
  value: unknown,
  fallback: number
): number {
  const n = typeof value === "string" ? Number( value ) : ( value as number );

  return typeof n === "number" && Number.isFinite( n ) && n > 0 ? n : fallback;
}

/**
 * Resolve a raw animation object into a guaranteed-valid `{ framerate,
 * duration }` pair. Always returns finite, positive numbers.
 */
export function resolveAnimation( animation: Partial<Animation> | null | undefined ): Animation {
  return {
    framerate: toPositiveNumber(
      animation?.framerate,
      DEFAULT_FRAMERATE
    ),
    duration: toPositiveNumber(
      animation?.duration,
      DEFAULT_DURATION
    )
  };
}

/**
 * Total captured frames for a resolved animation. Always ≥ 1 so a recorder
 * never spins up with a zero/negative frame budget.
 */
export function framesForAnimation( animation: Partial<Animation> | null | undefined ): number {
  const {
    duration, framerate
  } = resolveAnimation( animation );

  return Math.max(
    1,
    Math.round( duration * framerate )
  );
}

/**
 * Merge a per-slide override over the global value.
 *
 * Overrides can be partial — a slide form may have set only the framerate —
 * so a plain `override ?? global` would drop the global duration entirely.
 * Merging keeps every unset key on the global value.
 */
export function mergeSlideOverride<T extends object>(
  globalValue: T | undefined,
  override: Partial<T> | null | undefined
): T | undefined {
  if ( !override ) {
    return globalValue;
  }

  return {
    ...( globalValue ?? {} ),
    ...override
  } as T;
}

/**
 * Return the effective size + animation for `slideIndex`.
 *
 * - `slideIndex === undefined` → global settings.
 * - slide has its own `size`/`animation` → use the override (merged over
 *   the global so a partial override keeps the global's other keys).
 * - otherwise → fall back to global.
 *
 * The returned `animation` is always coerced to finite, positive numbers via
 * {@link resolveAnimation}, so callers can multiply `duration * framerate`
 * without guarding.
 */
export function getEffectiveSlideSettings(
  options: Record<string, any>,
  slideIndex?: number
): EffectiveSlideSettings {
  const globalSize: Size = options?.size ?? DEFAULTS.size;
  const globalAnimation: Partial<Animation> = options?.animation ?? DEFAULTS.animation;

  const slide =
    slideIndex === undefined ? undefined : options?.slides?.[ slideIndex ];

  const size = ( slide
    ? mergeSlideOverride(
      globalSize,
      slide.size
    )
    : globalSize ) as Size;

  const animation = resolveAnimation( slide
    ? mergeSlideOverride(
      globalAnimation,
      slide.animation
    )
    : globalAnimation );

  return {
    size,
    animation
  };
}

export type RecordingFramePlan = {
  totalFrames: number;
  framerate: number;
  duration: number;
};

/**
 * The canonical "how do we record this" answer, shared by the browser
 * recorder (`P5Engine`/`GsapEngine` → `createEngineHost`) and the server
 * recorder (`recordSketch`). Resolving both through one function is what
 * guarantees the FRONT and BACK recordings produce the same number of
 * frames at the same rate for identical options — the property the "duration
 * doesn't work in recordings" bug violated.
 */
export function getRecordingFramePlan(
  options: Record<string, any>,
  slideIndex?: number
): RecordingFramePlan {
  const {
    animation
  } = getEffectiveSlideSettings(
    options,
    slideIndex
  );

  return {
    totalFrames: framesForAnimation( animation ),
    framerate: animation.framerate,
    duration: animation.duration
  };
}
