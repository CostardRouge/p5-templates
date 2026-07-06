/**
 * Engine-agnostic resolver for a sketch's *effective* per-slide parameters.
 *
 * A template's tunable form values live under `options.sketch`. Once the deck
 * has slides, each slide may override a subset of those values under
 * `slides[i].sketch`, and the editor writes a parameter edit to the *active
 * slide's* override — not to the global block. So an engine that keeps reading
 * `options.sketch` directly will look frozen the moment a slide is created.
 *
 * This is the shared merge every engine's options accessor should go through:
 *   - no active slide (or no slides)  → the global `sketch` block, untouched;
 *   - active slide with overrides     → global merged with the slide's own.
 *
 * The p5 engine layers its montage/transition morphing on top of this (it
 * short-circuits before calling here); GSAP and Three.js use it directly.
 */
export function resolveEffectiveSketch(
  options: Record<string, any> | null | undefined,
  slideIndex: number | null | undefined
): Record<string, any> {
  const globalSketch = options?.sketch ?? {};
  const slides = options?.slides;

  if (
    slideIndex === null ||
    slideIndex === undefined ||
    !Array.isArray( slides ) ||
    slides.length === 0
  ) {
    return globalSketch;
  }

  // Match the p5 slides module: coerce + wrap so a transiently out-of-range or
  // negative index still resolves to a real slide instead of dropping overrides.
  const count = slides.length;
  const index = ( ( Math.floor( Number( slideIndex ) || 0 ) % count ) + count ) % count;
  const slide = slides[ index ];

  if ( !slide ) {
    return globalSketch;
  }

  return {
    ...globalSketch,
    ...( slide.sketch ?? {} )
  };
}
