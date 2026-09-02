/**
 * @jest-environment jsdom
 *
 * How an embedded sketch layer's three sizes relate.
 *
 * A layer has a box (where it lands on the host canvas), a canvas (what the
 * embedded sketch is told it has, and lays itself out for) and a buffer (how
 * many pixels that layout is rendered into). They used to be one number, which
 * is why `scale` cropped a sketch instead of shrinking it: `peaks-sphere` draws
 * a 250px-radius sphere whatever canvas it is given, so halving its canvas
 * halves the window onto an unchanged sphere.
 *
 * `resolution` is the pixel density, and only that — `bufferPixels` is the one
 * place layout and pixels part company, and the draw is pre-scaled by the same
 * ratio so nothing downstream sees the difference.
 */

export {};

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  bufferPixels
} = require( "@/p5/utils/nestedSketch.js" );
const {
  layerBox
} = require( "@/p5/utils/slides/common/drawSlideSketch.js" );
/* eslint-enable @typescript-eslint/no-require-imports */

const HOST = {
  width: 1080,
  height: 1350
};

describe(
  "layerBox",
  () => {
    it(
      "covers the host canvas at its defaults",
      () => {
        expect( layerBox(
          HOST,
          {}
        ) ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );

    it(
      "scales both axes together when it follows the canvas",
      () => {
        expect( layerBox(
          HOST,
          {
            scale: 0.5
          }
        ) ).toEqual( {
          width: 540,
          height: 675
        } );
      }
    );

    it(
      "takes its height from the aspect ratio when one is chosen",
      () => {
        expect( layerBox(
          HOST,
          {
            scale: 1,
            aspectRatio: "1:1"
          }
        ) ).toEqual( {
          width: 1080,
          height: 1080
        } );
      }
    );

    it(
      "answers for another scale, which is what 'scale' sizing lays out for",
      () => {
        // The layer lands at half size, but the sketch is laid out for the box
        // it would have at 1 — so `scale` scales the render instead of cropping
        // whatever the sketch drew at absolute pixel sizes.
        const item = {
          scale: 0.5,
          aspectRatio: "1:1"
        };

        expect( layerBox(
          HOST,
          item
        ) ).toEqual( {
          width: 540,
          height: 540
        } );
        expect( layerBox(
          HOST,
          item,
          1
        ) ).toEqual( {
          width: 1080,
          height: 1080
        } );
      }
    );
  }
);

describe(
  "bufferPixels",
  () => {
    it(
      "renders one pixel per layout pixel at resolution 1",
      () => {
        expect( bufferPixels(
          1080,
          1350,
          1
        ) ).toEqual( {
          pixelWidth: 1080,
          pixelHeight: 1350
        } );
      }
    );

    it(
      "is a density, so a coarse layer keeps its layout",
      () => {
        // The sketch is still laid out for 1080 × 1350 — the caller passes the
        // layout size, and the proxy reports it — so this is the same
        // composition in a quarter of the pixels, not a crop of it.
        expect( bufferPixels(
          1080,
          1350,
          0.5
        ) ).toEqual( {
          pixelWidth: 540,
          pixelHeight: 675
        } );
      }
    );

    it(
      "supersamples above 1",
      () => {
        expect( bufferPixels(
          400,
          300,
          2
        ) ).toEqual( {
          pixelWidth: 800,
          pixelHeight: 600
        } );
      }
    );

    it(
      "never allocates a zero-sided buffer",
      () => {
        expect( bufferPixels(
          8,
          8,
          0.05
        ) ).toEqual( {
          pixelWidth: 1,
          pixelHeight: 1
        } );
      }
    );

    it(
      "falls back to 1:1 on a nonsense density rather than vanishing",
      () => {
        for ( const bad of [
          0,
          -1,
          Number.NaN,
          undefined
        ] ) {
          expect( bufferPixels(
            300,
            200,
            bad
          ) ).toEqual( {
            pixelWidth: 300,
            pixelHeight: 200
          } );
        }
      }
    );
  }
);
