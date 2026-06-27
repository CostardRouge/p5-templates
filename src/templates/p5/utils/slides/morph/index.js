import animation from "../../animation.js";
import resolveMontageSources from "./resolveMontageSources.js";
import {
  mapProgressionToSegment
} from "./segmentMapper.js";
import lerpParams from "./lerpParams.js";

/**
 * Compute the effective sketch settings for a montage (transition) slide at the
 * current loop progression. The result replaces `{ ...global, ...slide.sketch }`
 * in slides.getSketchSettings, so the generative sketch — and any specs/HUD
 * overlay that reads `options.sketch` — sees the interpolated values for free.
 *
 * Returns null when the slide is not a montage (caller falls back to normal
 * per-slide settings).
 *
 * Fallbacks: 0 resolved sources → the montage slide's own sketch (renders as a
 * normal static slide); 1 source → that source held static (no morph).
 */
export default function getMontageSketch(
  globalSketch, montageSlide, allSlides
) {
  const transition = montageSlide?.transition;

  if ( !transition?.enabled ) {
    return null;
  }

  const base = globalSketch ?? {};
  const sources = resolveMontageSources(
    montageSlide,
    allSlides
  );

  if ( sources.length === 0 ) {
    return {
      ...base,
      ...( montageSlide.sketch ?? {} )
    };
  }

  if ( sources.length === 1 ) {
    return {
      ...base,
      ...( sources[ 0 ].sketch ?? {} )
    };
  }

  const {
    fromIndex,
    toIndex,
    localT
  } = mapProgressionToSegment(
    animation.progression,
    sources.length,
    transition
  );

  const fromSketch = {
    ...base,
    ...( sources[ fromIndex ].sketch ?? {} )
  };
  const toSketch = {
    ...base,
    ...( sources[ toIndex ].sketch ?? {} )
  };

  return lerpParams(
    fromSketch,
    toSketch,
    localT,
    Array.isArray( transition.snapKeys ) ? transition.snapKeys : []
  );
}
