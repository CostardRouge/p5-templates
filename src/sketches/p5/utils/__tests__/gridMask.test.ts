/**
 * Verifies that gridMask's spatial-hash field builder is numerically identical
 * to a naive O(cells * points) reduction for every supported mode:
 *   - pixel / falloff      (animated-text-points-v1-grid)
 *   - normalized / falloff (36days-of-type-2023-1,2,3,6)
 *   - normalized / boolean (36days-of-type-2023-4,5,7,8)
 *
 * The spatial hash only changes WHICH points are scanned per cell; the claim is
 * that points beyond `distance` never affect the result, so the alpha field
 * must match the naive version exactly.
 */

// Mutable canvas size shared with the mocked p5 instance.
const mockState = {
  width: 1000,
  height: 1000
};

// p5.map (with optional constrain), implemented to match p5 exactly.
function p5map(
  n: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number,
  withinBounds = false
): number {
  const value = ( ( n - start1 ) / ( stop1 - start1 ) ) * ( stop2 - start2 ) + start2;

  if ( !withinBounds ) {
    return value;
  }

  const lower = Math.min(
    start2,
    stop2
  );
  const upper = Math.max(
    start2,
    stop2
  );

  return Math.max(
    lower,
    Math.min(
      upper,
      value
    )
  );
}

jest.mock(
  "../sketch.js",
  () => ( {
    __esModule: true,
    getP5: () => ( {
      get width() {
        return mockState.width;
      },
      get height() {
        return mockState.height;
      },
      map: p5map
    } )
  } )
);

jest.mock(
  "../grid.js",
  () => ( {
    __esModule: true,
    default: {
      create: jest.fn()
    }
  } )
);

import gridMask from "../gridMask.js";
import grid from "../grid.js";

type Pt = { x: number;
  y: number };
type Cell = { x: number;
  y: number;
  position: Pt };

function makeCells(
  columns: number,
  rows: number,
  width: number,
  height: number
): Cell[] {
  const cells: Cell[] = [];
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  for ( let row = 0; row < rows; row++ ) {
    for ( let column = 0; column < columns; column++ ) {
      const x = -width / 2 + column * cellWidth;
      const y = -height / 2 + row * cellHeight;

      cells.push( {
        x,
        y,
        position: {
          x,
          y
        }
      } );
    }
  }

  return cells;
}

function randomPoints(
  count: number,
  width: number,
  height: number,
  seed: number
): Pt[] {
  // Tiny deterministic PRNG so failures reproduce.
  let s = seed;
  const rng = () => {
    s = ( s * 1103515245 + 12345 ) & 0x7fffffff;

    return s / 0x7fffffff;
  };

  return Array.from(
    {
      length: count
    },
    () => ( {
      x: ( rng() - 0.5 ) * width,
      y: ( rng() - 0.5 ) * height
    } )
  );
}

function naiveField(
  cells: Cell[],
  points: Pt[],
  {
    distance,
    space,
    output,
    lo,
    hi,
    excludeZeroDistance,
    width,
    height
  }: {
    distance: number;
    space: "pixel" | "normalized";
    output: "falloff" | "boolean";
    lo: number;
    hi: number;
    excludeZeroDistance: boolean;
    width: number;
    height: number;
  }
): number[] {
  const toMetric =
    space === "normalized"
      ? (
        x: number, y: number
      ): [number, number] => [
        p5map(
          x,
          -width / 2,
          width / 2,
          0,
          1
        ),
        p5map(
          y,
          -height / 2,
          height / 2,
          0,
          1
        )
      ]
      : (
        x: number, y: number
      ): [number, number] => [
        x,
        y
      ];

  return cells.map( ( cell ) => {
    const [
      cx,
      cy
    ] = toMetric(
      cell.x,
      cell.y
    );

    let a = 0;

    for ( const point of points ) {
      const [
        mx,
        my
      ] = toMetric(
        point.x,
        point.y
      );
      const d = Math.sqrt( ( mx - cx ) ** 2 + ( my - cy ) ** 2 );

      if ( output === "boolean" ) {
        const inside = ( !excludeZeroDistance || d > 0 ) && d < distance;

        a = Math.max(
          a,
          inside ? 1 : 0
        );
      } else {
        a = Math.max(
          a,
          ~~p5map(
            d,
            0,
            distance,
            hi,
            lo,
            true
          )
        );
      }
    }

    return a;
  } );
}

describe(
  "gridMask.field",
  () => {
    const cases = [
      {
        name: "pixel / falloff (square canvas)",
        width: 1000,
        height: 1000,
        space: "pixel" as const,
        output: "falloff" as const,
        distance: 37,
        excludeZeroDistance: false
      },
      {
        name: "normalized / falloff (square canvas)",
        width: 1000,
        height: 1000,
        space: "normalized" as const,
        output: "falloff" as const,
        distance: 0.025,
        excludeZeroDistance: false
      },
      {
        name: "normalized / boolean (anisotropic canvas)",
        width: 1200,
        height: 600,
        space: "normalized" as const,
        output: "boolean" as const,
        distance: 0.015,
        excludeZeroDistance: true
      }
    ];

    test.each( cases )(
      "matches the naive reduction for $name",
      ( testCase ) => {
        mockState.width = testCase.width;
        mockState.height = testCase.height;

        const columns = 40;
        const rows = Math.round( ( columns * testCase.height ) / testCase.width );
        const cells = makeCells(
          columns,
          rows,
          testCase.width,
          testCase.height
        );

        ( grid.create as jest.Mock ).mockReturnValue( {
          cells
        } );

        const points = randomPoints(
          250,
          testCase.width,
          testCase.height,
          12345
        );

        const gridOptions = {
          topLeft: {
            x: -testCase.width / 2,
            y: -testCase.height / 2
          },
          topRight: {
            x: testCase.width / 2,
            y: -testCase.height / 2
          },
          bottomLeft: {
            x: -testCase.width / 2,
            y: testCase.height / 2
          },
          bottomRight: {
            x: testCase.width / 2,
            y: testCase.height / 2
          },
          rows,
          columns
        };

        const field = gridMask.field( {
          gridOptions,
          points,
          signature: testCase.name,
          distance: testCase.distance,
          space: testCase.space,
          output: testCase.output,
          alphaRange: [
            0,
            255
          ],
          excludeZeroDistance: testCase.excludeZeroDistance
        } );

        const expected = naiveField(
          cells,
          points,
          {
            distance: testCase.distance,
            space: testCase.space,
            output: testCase.output,
            lo: 0,
            hi: 255,
            excludeZeroDistance: testCase.excludeZeroDistance,
            width: testCase.width,
            height: testCase.height
          }
        );

        expect( Array.from( field.alpha ) ).toEqual( expected );

        const expectedNonZero = expected
          .map( (
            value, index
          ) => ( {
            value,
            index
          } ) )
          .filter( ( {
            value
          } ) => value !== 0 )
          .map( ( {
            index
          } ) => index );

        expect( field.nonZero ).toEqual( expectedNonZero );
      }
    );
  }
);

describe(
  "gridMask.lerpField",
  () => {
    test(
      "linearly interpolates two fields element-wise",
      () => {
        const a = {
          alpha: new Float32Array( [
            0,
            100,
            255
          ] )
        };
        const b = {
          alpha: new Float32Array( [
            255,
            100,
            0
          ] )
        };

        const out = gridMask.lerpField(
          a as never,
          b as never,
          0.5
        );

        expect( Array.from( out ) ).toEqual( [
          127.5,
          100,
          127.5
        ] );
      }
    );
  }
);
