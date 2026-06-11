import {
  calculateZoomTarget,
  calculateFitToViewport,
  calculateActualPixels,
  MIN_SCALE,
  MAX_SCALE
} from "../zoomCalculations";

const containerRect = {
  left: 0,
  top: 0
} as DOMRect;

describe(
  "calculateZoomTarget",
  () => {
    it(
      "keeps the point under the cursor stationary while zooming",
      () => {
        const result = calculateZoomTarget(
          2,
          100,
          100,
          containerRect,
          {
            x: 0,
            y: 0,
            scale: 1
          }
        );

        // The content coordinate under the cursor was (100 - 0) / 1 = 100;
        // after zooming, its screen position must still be 100.
        expect( result.scale ).toBe( 2 );
        expect( result.x + 100 * result.scale ).toBeCloseTo( 100 );
        expect( result.y + 100 * result.scale ).toBeCloseTo( 100 );
      }
    );

    it(
      "clamps the requested scale into [MIN_SCALE, MAX_SCALE]",
      () => {
        const transform = {
          x: 0,
          y: 0,
          scale: 1
        };

        expect( calculateZoomTarget(
          0,
          0,
          0,
          containerRect,
          transform
        ).scale ).toBe( MIN_SCALE );

        expect( calculateZoomTarget(
          100,
          0,
          0,
          containerRect,
          transform
        ).scale ).toBe( MAX_SCALE );
      }
    );
  }
);

describe(
  "calculateFitToViewport",
  () => {
    it(
      "scales to 90% of the limiting dimension and centers the content",
      () => {
        const result = calculateFitToViewport(
          200,
          100,
          1000,
          1000
        );

        // Width is the limiting dimension: ( 1000 / 200 ) * 0.9 = 4.5.
        expect( result.scale ).toBeCloseTo( 4.5 );
        expect( result.x ).toBeCloseTo( ( 1000 - 200 * 4.5 ) / 2 );
        expect( result.y ).toBeCloseTo( ( 1000 - 100 * 4.5 ) / 2 );
      }
    );

    it(
      "returns the identity transform for empty content",
      () => {
        expect( calculateFitToViewport(
          0,
          0,
          1000,
          1000
        ) ).toEqual( {
          x: 0,
          y: 0,
          scale: 1
        } );
      }
    );
  }
);

describe(
  "calculateActualPixels",
  () => {
    it(
      "centers the content at scale 1",
      () => {
        expect( calculateActualPixels(
          400,
          200,
          1000,
          800
        ) ).toEqual( {
          x: 300,
          y: 300,
          scale: 1
        } );
      }
    );
  }
);
