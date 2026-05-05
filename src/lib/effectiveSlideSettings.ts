/**
 * Engine-agnostic helper that resolves the *effective* size and animation
 * for a given slide.  Per-slide overrides win; otherwise the global value
 * is used as the fallback.
 */

type Size = { width: number;
  height: number };
type Animation = { framerate: number;
  duration: number };

export type EffectiveSlideSettings = {
  size: Size;
  animation: Animation;
};

const DEFAULTS: EffectiveSlideSettings = {
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    framerate: 60,
    duration: 12
  }
};

/**
 * Return the effective size + animation for `slideIndex`.
 *
 * - `slideIndex === undefined` → global settings.
 * - slide has its own `size`/`animation` → use the override.
 * - otherwise → fall back to global.
 */
export function getEffectiveSlideSettings(
  options: Record<string, any>,
  slideIndex?: number
): EffectiveSlideSettings {
  const globalSize: Size = options?.size ?? DEFAULTS.size;
  const globalAnimation: Animation = options?.animation ?? DEFAULTS.animation;

  if ( slideIndex === undefined ) {
    return {
      size: globalSize,
      animation: globalAnimation
    };
  }

  const slide = options?.slides?.[ slideIndex ];

  if ( !slide ) {
    return {
      size: globalSize,
      animation: globalAnimation
    };
  }

  return {
    size: slide.size ?? globalSize,
    animation: slide.animation ?? globalAnimation
  };
}
