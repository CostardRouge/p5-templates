/**
 * Unit tests for the metaballs maths shared module.
 *
 * The marching-squares case table is the most error-prone part of the category,
 * so these tests pin down the invariants that guarantee a correct contour:
 *   - the iso-contour of a single ball is a closed loop (every crossing point is
 *     shared by exactly two segments);
 *   - the field equals the threshold exactly at one radius from a lone ball;
 *   - single-corner cells emit exactly one segment;
 *   - palette output stays in gamut.
 *
 * getP5 is mocked because the pure maths never touch p5 (only the drift motion
 * mode does), and importing the real sketch runtime pulls in browser globals.
 */
jest.mock(
  "@/p5/utils/sketch.js",
  () => ( {
    getP5: () => ( {
      noise: () => 0.5
    } )
  } ),
  {
    virtual: true
  }
);

import {
  sampleField,
  buildFieldGrid,
  marchingSquaresContour,
  palette,
  fieldToUnit,
  pointersToBalls,
  combineBalls
} from "@/p5/sketches/metaballs/_metaballs.js";

type Ball = { x: number;
  y: number;
  r: number };

function roundKey(
  x: number, y: number
): string {
  return `${ x.toFixed( 4 ) }:${ y.toFixed( 4 ) }`;
}

describe(
  "metaballs scalar field",
  () => {
    it(
      "equals the threshold exactly one radius from a lone ball",
      () => {
        const balls: Ball[] = [
          {
            x: 0,
            y: 0,
            r: 50
          }
        ];

        // f = r²/d² = 1 when d = r.
        expect( sampleField(
          balls,
          50,
          0
        ) ).toBeCloseTo(
          1,
          4
        );
        expect( sampleField(
          balls,
          0,
          50
        ) ).toBeCloseTo(
          1,
          4
        );
      }
    );

    it(
      "fieldToUnit maps the threshold to 0.5",
      () => {
        expect( fieldToUnit(
          1,
          1
        ) ).toBeCloseTo(
          0.5,
          6
        );
        expect( fieldToUnit(
          3,
          1
        ) ).toBeGreaterThan( 0.5 );
        expect( fieldToUnit(
          0.2,
          1
        ) ).toBeLessThan( 0.5 );
      }
    );
  }
);

describe(
  "marching squares",
  () => {
    it(
      "produces a closed contour around a single ball",
      () => {
        const balls: Ball[] = [
          {
            x: 100,
            y: 100,
            r: 45
          }
        ];
        const cols = 40;
        const rows = 40;
        const cellW = 200 / cols;
        const cellH = 200 / rows;
        const field = buildFieldGrid(
          balls,
          cols,
          rows,
          cellW,
          cellH,
          null
        );

        const endpointCounts = new Map<string, number>();
        let segmentCount = 0;

        marchingSquaresContour(
          field,
          cols,
          rows,
          cellW,
          cellH,
          1,
          true,
          (
            x1: number, y1: number, x2: number, y2: number
          ) => {
            segmentCount++;
            const k1 = roundKey(
              x1,
              y1
            );
            const k2 = roundKey(
              x2,
              y2
            );

            endpointCounts.set(
              k1,
              ( endpointCounts.get( k1 ) ?? 0 ) + 1
            );
            endpointCounts.set(
              k2,
              ( endpointCounts.get( k2 ) ?? 0 ) + 1
            );
          }
        );

        expect( segmentCount ).toBeGreaterThan( 8 );

        // Closed manifold: every crossing point is shared by exactly two segments.
        for ( const count of endpointCounts.values() ) {
          expect( count ).toBe( 2 );
        }
      }
    );

    it(
      "emits exactly one segment for a single-corner cell",
      () => {
        // 2×2 lattice (1 cell). Only the top-left node is above threshold.
        const field = new Float32Array( [
          2,
          0,
          0,
          0
        ] );
        let segments = 0;

        marchingSquaresContour(
          field,
          1,
          1,
          10,
          10,
          1,
          true,
          () => {
            segments++;
          }
        );

        expect( segments ).toBe( 1 );
      }
    );
  }
);

describe(
  "interaction → balls",
  () => {
    it(
      "pointersToBalls maps each pointer to a ball with the given radius",
      () => {
        const balls = pointersToBalls(
          [
            {
              x: 10,
              y: 20
            },
            {
              x: 30,
              y: 40
            }
          ],
          50
        );

        expect( balls ).toEqual( [
          {
            x: 10,
            y: 20,
            r: 50
          },
          {
            x: 30,
            y: 40,
            r: 50
          }
        ] );
      }
    );

    it(
      "combineBalls honours add / replace / off",
      () => {
        const proc = [
          {
            x: 0,
            y: 0,
            r: 5
          }
        ];
        const pointers = [
          {
            x: 1,
            y: 1
          }
        ];

        expect( combineBalls(
          proc,
          pointers,
          9,
          "add"
        ) ).toHaveLength( 2 );
        expect( combineBalls(
          proc,
          pointers,
          9,
          "replace"
        ) ).toEqual( [
          {
            x: 1,
            y: 1,
            r: 9
          }
        ] );

        // "off" and "add with no pointers" both return the procedural set as-is.
        expect( combineBalls(
          proc,
          pointers,
          9,
          "off"
        ) ).toBe( proc );
        expect( combineBalls(
          proc,
          [],
          9,
          "add"
        ) ).toBe( proc );
      }
    );
  }
);

describe(
  "palette",
  () => {
    it(
      "stays within the 0..255 gamut for all channels",
      () => {
        for ( let i = 0; i <= 10; i++ ) {
          const rgb = palette(
            "rainbow",
            i / 10
          );

          expect( rgb ).toHaveLength( 3 );

          for ( const c of rgb ) {
            expect( c ).toBeGreaterThanOrEqual( 0 );
            expect( c ).toBeLessThanOrEqual( 255 );
          }
        }
      }
    );
  }
);
