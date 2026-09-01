/**
 * @jest-environment jsdom
 *
 * The per-layer frame rate of an embedded sketch ("sketch" content item).
 *
 * A layer can run slower than the page it sits on — both to buy back
 * performance and as a look (a 6 fps layer over a 60 fps sketch reads as
 * stop-motion). The rule that makes that a *design* decision rather than a
 * rendering artefact is that the step is counted in LOOP time, the same clock
 * `time.drawSeconds()` gives every sketch: during capture that clock is pinned
 * to the frame index, so a recording drops exactly the frames the preview
 * dropped. Counting in wall-clock milliseconds would have made a slow layer
 * sample whatever the browser managed at the time, and no two runs would match.
 */

import {
  redrawStep
} from "@/p5/utils/nestedSketch.js";

describe(
  "redrawStep",
  () => {
    it(
      "returns null when the layer follows the host (rate 0)",
      () => {
        expect( redrawStep(
          1.234,
          0
        ) ).toBeNull();
      }
    );

    it(
      "holds one step across the whole interval it covers",
      () => {
        // At 6 fps a redraw happens every 1/6th of a loop second; every frame
        // in between reuses the buffer the last redraw left.
        expect( redrawStep(
          1,
          6
        ) ).toBe( 6 );
        expect( redrawStep(
          1.1,
          6
        ) ).toBe( 6 );
        expect( redrawStep(
          1.2,
          6
        ) ).toBe( 7 );
      }
    );

    it(
      "is a pure function of the loop clock, so capture and preview agree",
      () => {
        const first = redrawStep(
          3.7,
          12
        );

        expect( redrawStep(
          3.7,
          12
        ) ).toBe( first );
      }
    );

    it(
      "follows the host rather than dividing by a nonsense rate",
      () => {
        expect( redrawStep(
          1,
          -5
        ) ).toBeNull();
        expect( redrawStep(
          Number.NaN,
          24
        ) ).toBeNull();
      }
    );
  }
);
