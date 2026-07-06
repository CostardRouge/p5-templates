/* ------------------------------------------------------------------ */
/*  Three.js options accessor                                          */
/* ------------------------------------------------------------------ */

/**
 * Live view over the shared sketch-options store.
 *
 * A Three.js template reads its own form values through `options.sketch`, and
 * the baseline `options.size` / `options.animation` blocks the same way a p5
 * sketch does. Every access reads the current store, so option changes pushed
 * from the React form are reflected on the next draw with no manual wiring.
 *
 * `options.sketch` merges the active slide's per-slide overrides over the global
 * block via the shared, engine-agnostic resolver — the same merge p5 does. Once
 * the deck has slides, the editor writes a parameter edit to the active slide's
 * override, so reading the raw global block would look frozen.
 */
import {
  getSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  getActiveSlideIndex
} from "./sketch.js";
import {
  resolveEffectiveSketch
} from "@/lib/effectiveSketch";

// Resolve which slide's overrides `options.sketch` should merge. A deck with
// slides always has one active slide (React coerces its effective index to 0,
// and the p5 engine recovers null→0), so default to the first before the studio
// UI has wired `window.setSlide` — otherwise a freshly loaded multi-slide deck
// would briefly render the global params instead of slide 0's.
function activeSlideIndexFor( live ) {
  const index = getActiveSlideIndex();

  if ( index !== null && index !== undefined ) {
    return index;
  }

  return Array.isArray( live?.slides ) && live.slides.length > 0 ? 0 : null;
}

const options = new Proxy(
  {},
  {
    get(
      _, prop
    ) {
      const live = getSketchOptions();

      if ( prop === "sketch" ) {
        return resolveEffectiveSketch(
          live,
          activeSlideIndexFor( live )
        );
      }

      return live?.[ prop ];
    }
  }
);

export default options;
