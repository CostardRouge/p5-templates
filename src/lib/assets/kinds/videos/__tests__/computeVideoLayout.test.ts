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

function params( patch: Partial<VideoParams> = {} ): VideoParams {
  return {
    ...defaultVideoParams,
    ...patch
  };
}

describe(
  "computeVideoLayout",
  () => {
    it(
      "fills the box exactly with default params (stretch, scale 1)",
      () => {
        expect( computeVideoLayout(
          params(),
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
        expect( computeVideoLayout(
          undefined,
          BOX,
          SQUARE
        ) ).toEqual( {
          x: 0,
          y: 0,
          width: 200,
          height: 100
        } );

        // A non-positive scale is treated as 1 rather than vanishing the frame.
        expect( computeVideoLayout(
          {
            scale: 0
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
  }
);
