/**
 * Covers the glyph rectangle both text-shaped content items ("text", "title")
 * report as their on-canvas grab surface.
 *
 * What matters here is that the reported rectangle tracks the GLYPHS and not
 * the layout box: the layout box is the whole canvas minus the item's margins,
 * so reporting it would give the item a near-full-canvas grab surface that
 * swallows every press meant for another item — the bug that kept the title
 * un-draggable.
 */

const registry: Array<{ x: number;
  y: number;
  w: number;
  h: number }> = [];

jest.mock(
  "../itemBoundsRegistry.js",
  () => ( {
    __esModule: true,
    reportItemBounds: (
      x: number, y: number, w: number, h: number
    ) => {
      registry.push( {
        x,
        y,
        w,
        h
      } );
    }
  } )
);

import reportTextItemBounds from "../textItemBounds.js";

// A 1000×1000 canvas with a 2% margin: the layout box is (20, 20) → 960×960.
const LAYOUT = {
  x: 20,
  y: 20,
  layoutWidth: 960,
  layoutHeight: 960,
  size: 100
};

beforeEach( () => {
  registry.length = 0;
} );

describe(
  "reportTextItemBounds",
  () => {
    it(
      "reports the measured glyph rectangle, not the layout box",
      () => {
        reportTextItemBounds( {
          ...LAYOUT,
          text: "hello",
          box: {
            w: 300,
            h: 100
          },
          horizontalAlign: "center",
          verticalAlign: "center"
        } );

        expect( registry ).toHaveLength( 1 );

        const [
          bounds
        ] = registry;

        // Centred inside the layout box on both axes.
        expect( bounds.w ).toBe( 300 );
        expect( bounds.h ).toBe( 100 );
        expect( bounds.x ).toBe( 20 + ( 960 - 300 ) / 2 );
        expect( bounds.y ).toBe( 20 + ( 960 - 100 ) / 2 );
      }
    );

    it(
      "aligns the rectangle with the item's horizontal alignment",
      () => {
        const box = {
          w: 300,
          h: 100
        };

        reportTextItemBounds( {
          ...LAYOUT,
          text: "hello",
          box,
          horizontalAlign: "left",
          verticalAlign: "top"
        } );
        reportTextItemBounds( {
          ...LAYOUT,
          text: "hello",
          box,
          horizontalAlign: "right",
          verticalAlign: "top"
        } );

        expect( registry[ 0 ].x ).toBe( 20 );
        expect( registry[ 1 ].x ).toBe( 20 + 960 - 300 );
      }
    );

    it(
      "spans a glyph height either side of y for baseline alignment",
      () => {
        reportTextItemBounds( {
          ...LAYOUT,
          text: "hello",
          box: {
            w: 300,
            h: 100
          },
          horizontalAlign: "center",
          verticalAlign: "baseline"
        } );

        expect( registry[ 0 ].y ).toBe( 20 - 100 );
        expect( registry[ 0 ].h ).toBe( 200 );
      }
    );

    it(
      "measures the longest line of a multi-line string and stacks the lines",
      () => {
        // The font measures "A\nBBBB\nCC" as ONE run: too wide, one line tall.
        // With a per-line measure the rectangle hugs the longest line instead.
        reportTextItemBounds( {
          ...LAYOUT,
          text: "A\nBBBB\nCC",
          box: {
            w: 900,
            h: 100
          },
          horizontalAlign: "center",
          verticalAlign: "top",
          measureLine: ( line: string ) => line.length * 50
        } );

        expect( registry[ 0 ].w ).toBe( 200 ); // "BBBB" → 4 × 50
        expect( registry[ 0 ].h ).toBe( 300 ); // 3 lines × size
      }
    );

    it(
      "never reports wider or taller than the layout box",
      () => {
        reportTextItemBounds( {
          ...LAYOUT,
          text: "hello",
          box: {
            w: 5000,
            h: 5000
          },
          horizontalAlign: "center",
          verticalAlign: "top"
        } );

        expect( registry[ 0 ].w ).toBe( 960 );
        expect( registry[ 0 ].h ).toBe( 960 );
      }
    );

    it(
      "reports nothing when there is no text drawn",
      () => {
        reportTextItemBounds( {
          ...LAYOUT,
          text: "",
          box: undefined,
          horizontalAlign: "center",
          verticalAlign: "center"
        } );

        expect( registry ).toHaveLength( 0 );
      }
    );
  }
);
