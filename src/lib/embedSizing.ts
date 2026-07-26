/**
 * Resolution helpers for the `/embed` route.
 *
 * A share URL can pin the canvas to a fixed resolution (`#s=1920x1080`) or ask
 * it to track the iframe itself (`#s=fill`). Both end up as a plain
 * `{ width, height }` written onto the options tree before the engine boots —
 * these helpers do that translation, and nothing else.
 */
import clamp from "@/utils/clamp";
import {
  EMBED_SIZE_MAX, EMBED_SIZE_MIN
} from "@/lib/embedOptions";

export type EmbedFrameSize = {
  width: number;
  height: number;
};

/**
 * Turn a measured frame box into a canvas resolution.
 *
 * `marginFactor` insets the canvas inside the frame (1 = flush, 0.9 = the
 * studio's gutter): in fill mode the margin is baked into the resolution
 * itself, since the canvas *is* the frame and there is nothing left to scale.
 * Sides are rounded to whole pixels and clamped to the schema's bounds, so a
 * collapsed (0-height) frame still yields a bootable canvas.
 */
export function resolveFillSize(
  frameWidth: number,
  frameHeight: number,
  marginFactor = 1
): EmbedFrameSize {
  const side = ( value: number ) => clamp(
    Math.round( value * marginFactor ),
    EMBED_SIZE_MIN,
    EMBED_SIZE_MAX
  );

  return {
    width: side( frameWidth ),
    height: side( frameHeight )
  };
}

/**
 * Write `size` onto an options tree, non-destructively.
 *
 * Slides carry their own optional `size` override which *masks* the global one
 * (see `mergeSlideOverride`), so a deck would otherwise ignore the requested
 * resolution — every slide that defines a size is rewritten too. Slides without
 * an override are left alone: they already follow the global size.
 */
export function applyEmbedSize<T extends Record<string, any>>(
  options: T,
  size: EmbedFrameSize
): T {
  const slides = options?.slides;
  const next: Record<string, any> = {
    ...options,
    size: {
      ...size
    }
  };

  if ( Array.isArray( slides ) && slides.length > 0 ) {
    next.slides = slides.map( ( slide ) =>
      slide && typeof slide === "object" && slide.size
        ? {
          ...slide,
          size: {
            ...size
          }
        }
        : slide );
  }

  return next as T;
}

/** True when two resolutions are the same — used to skip no-op resize churn. */
export function isSameSize(
  a: EmbedFrameSize | null | undefined,
  b: EmbedFrameSize | null | undefined
): boolean {
  return Boolean( a && b && a.width === b.width && a.height === b.height );
}
