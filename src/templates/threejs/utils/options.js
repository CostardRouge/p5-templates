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
 */
import {
  getSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

const options = new Proxy(
  {},
  {
    get(
      _, prop
    ) {
      const live = getSketchOptions();

      if ( prop === "sketch" ) {
        return live?.sketch ?? {};
      }

      return live?.[ prop ];
    }
  }
);

export default options;
