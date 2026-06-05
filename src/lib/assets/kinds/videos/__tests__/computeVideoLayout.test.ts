/**
 * Unit tests for `computeVideoLayout`, the interpreter that turns the
 * per-instance layout params (`scale`, `posX`, `posY`, `fit`) into the
 * pixel rectangle a sketch draws the video frame into.
 */
import {
  computeVideoLayout, defaultVideoParams, type VideoParams
} from "../types";

const BOX = {
  x: 0,
  y: 0,
  width: 200,
  height: 100
};

// A 1:1 source so `contain` / `cover` have a ratio to reconcile against the
// 2:1 box above.
const SQUARE = {
  width: 50,
  height: 50
};

// Neutral baseline (scale 1, stretch) so each test exercises a single param
// in isolation, independent of the shipped defaults. The shipped defaults get
// their own dedicated test below.
function params( patch: Partial<VideoParams> = {} ): VideoParams {
  return {
    ...defaultVideoParams,
    scale: 1,
    fit: "stretch",
    ...patch
  };
}

describe(
  "computeVideoLayout",
  () => {
    it(
      "fills the box exactly with stretch + scale 1",
      () => {
        expect( computeVideoLayout(
          params( {
            scale: 1,
            fit: "stretch"
          } ),
          BOX,
          SQUARE
        ) ).toEqual( {
          x: 0,
          y: 0,
          width: 200,
          height: 100
        } );
      }
    );

    it(
      "applies the shipped defaults (scale 0.5, contain)",
      () => {
        // Square contained in the 2:1 box → 100×100, then halved → 50×50,
        // centered in the 200×100 box.
        expect( computeVideoLayout(
          defaultVideoParams,
          BOX,
          SQUARE
        ) ).toEqual( {
          x: 75,
          y: 25,
          width: 50,
          height: 50
        } );
      }
    );

    it(
      "ignores the native ratio in stretch mode",
      () => {
        // Even a wildly non-square source fills the whole box when stretched.
        expect( computeVideoLayout(
          params( {
            fit: "stretch"
          } ),
          BOX,
          {
            width: 1920,
            height: 1080
          }
        ) ).toEqual( {
          x: 0,
          y: 0,
          width: 200,
          height: 100
        } );
      }
    );

    it(
      "scales relative to the box and keeps the result centered",
      () => {
        // Half size → 100×50, centered in the 200×100 box.
        expect( computeVideoLayout(
          params( {
            scale: 0.5
          } ),
          BOX,
          SQUARE
        ) ).toEqual( {
          x: 50,
          y: 25,
          width: 100,
          height: 50
        } );
      }
    );

    it(
      "lets scale > 1 overflow the box on purpose",
      () => {
        const layout = computeVideoLayout(
          params( {
            scale: 2
          } ),
          BOX,
          SQUARE
        );

        expect( layout.width ).toBe( 400 );
        expect( layout.height ).toBe( 200 );
        // Centered, so it overflows symmetrically.
        expect( layout.x ).toBe( -100 );
        expect( layout.y ).toBe( -50 );
      }
    );

    it(
      "offsets by a fraction of the box size",
      () => {
        // posX/posY of 1 shifts by a full box width / height.
        const layout = computeVideoLayout(
          params( {
            posX: 0.5,
            posY: -0.25
          } ),
          BOX,
          SQUARE
        );

        expect( layout.x ).toBe( 0 + 0.5 * 200 );
        expect( layout.y ).toBe( 0 + -0.25 * 100 );
      }
    );

    it(
      "contains a square source inside a wide box (letterbox)",
      () => {
        // Square fit inside 2:1 box → 100×100, centered horizontally.
        const layout = computeVideoLayout(
          params( {
            fit: "contain"
          } ),
          BOX,
          SQUARE
        );

        expect( layout.width ).toBe( 100 );
        expect( layout.height ).toBe( 100 );
        expect( layout.x ).toBe( 50 );
        expect( layout.y ).toBe( 0 );
      }
    );

    it(
      "covers a wide box with a square source (overflow top/bottom)",
      () => {
        // Square covering 2:1 box → 200×200, overflowing vertically.
        const layout = computeVideoLayout(
          params( {
            fit: "cover"
          } ),
          BOX,
          SQUARE
        );

        expect( layout.width ).toBe( 200 );
        expect( layout.height ).toBe( 200 );
        expect( layout.x ).toBe( 0 );
        expect( layout.y ).toBe( -50 );
      }
    );

    it(
      "falls back to stretch when the native size is unknown",
      () => {
        // No metadata yet → can't honor the ratio, so contain/cover degrade to
        // filling the box rather than collapsing to zero.
        expect( computeVideoLayout(
          params( {
            fit: "contain"
          } ),
          BOX,
          {
            width: 0,
            height: 0
          }
        ) ).toEqual( {
          x: 0,
          y: 0,
          width: 200,
          height: 100
        } );
      }
    );

    it(
      "tolerates missing / partial params via defaults",
      () => {
        // No params → shipped defaults (scale 0.5, contain): 50×50 centered.
        expect( computeVideoLayout(
          undefined,
          BOX,
          SQUARE
        ) ).toEqual( {
          x: 75,
          y: 25,
          width: 50,
          height: 50
        } );

        // A non-positive scale is treated as 1 rather than vanishing the frame.
        expect( computeVideoLayout(
          {
            scale: 0,
            fit: "stretch"
          } as Partial<VideoParams>,
          BOX,
          SQUARE
        ).width ).toBe( 200 );
      }
    );

    it(
      "respects a non-zero box origin",
      () => {
        const layout = computeVideoLayout(
          params( {
            scale: 0.5
          } ),
          {
            x: 1000,
            y: 500,
            width: 200,
            height: 100
          },
          SQUARE
        );

        expect( layout.x ).toBe( 1000 + 50 );
        expect( layout.y ).toBe( 500 + 25 );
      }
    );

    // Contract relied on by the video-player sketch *and* the settings
    // preview: when the box is given its true (non-square) aspect ratio, the
    // drawn rectangle must keep the video's native ratio at every scale. This
    // is exactly why the preview must pass a ratio-shaped box, not a square
    // one — a square box silently distorts contain/cover by the canvas ratio.
    it(
      "preserves the native ratio in contain at any scale and box shape",
      () => {
        // Portrait canvas (1080×1350) with a landscape clip (1920×1080).
        const portraitCanvas = {
          x: 0,
          y: 0,
          width: 1080,
          height: 1350
        };
        const landscape = {
          width: 1920,
          height: 1080
        };
        const nativeRatio = landscape.width / landscape.height;

        for ( const scale of [
          0.5,
          1,
          2
        ] ) {
          const layout = computeVideoLayout(
            params( {
              fit: "contain",
              scale
            } ),
            portraitCanvas,
            landscape
          );

          expect( layout.width / layout.height ).toBeCloseTo(
            nativeRatio,
            10
          );
        }
      }
    );
  }
);
