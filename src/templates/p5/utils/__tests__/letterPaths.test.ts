/**
 * Geometry contract for the `letter-trace` category. These helpers decide where
 * the pen is and which slice of an outline is drawn, so the sketches are only as
 * correct as the maths here: contours must split on the textToPoints hops,
 * resampling must produce genuinely even arc-length spacing (constant pen speed),
 * and rotation must preserve the ring while moving its start.
 */

import {
  distance,
  splitContours,
  resampleContour,
  rotateContour,
  hashedRandom
} from "../letterPaths.js";

type Point = { x: number;
  y: number };

function spacingsOf(
  points: Point[], closed: boolean
): number[] {
  const out: number[] = [];

  for ( let i = 1; i < points.length; i++ ) {
    out.push( distance(
      points[ i - 1 ],
      points[ i ]
    ) );
  }

  if ( closed && points.length > 1 ) {
    out.push( distance(
      points[ points.length - 1 ],
      points[ 0 ]
    ) );
  }

  return out;
}

describe(
  "splitContours",
  () => {
    it(
      "returns nothing for empty input",
      () => {
        expect( splitContours(
          [],
          10
        ) ).toEqual( [] );
      }
    );

    it(
      "keeps a single run with no large hop as one contour",
      () => {
        const points: Point[] = [
          {
            x: 0,
            y: 0
          },
          {
            x: 1,
            y: 0
          },
          {
            x: 2,
            y: 0
          }
        ];

        const contours = splitContours(
          points,
          5
        );

        expect( contours ).toHaveLength( 1 );
        expect( contours[ 0 ] ).toHaveLength( 3 );
      }
    );

    it(
      "splits exactly on the hop between two outlines (e.g. O outer → hole)",
      () => {
        const points: Point[] = [
          {
            x: 0,
            y: 0
          },
          {
            x: 2,
            y: 0
          },
          // long hop across the glyph to the inner contour:
          {
            x: 100,
            y: 100
          },
          {
            x: 102,
            y: 100
          }
        ];

        const contours = splitContours(
          points,
          10
        );

        expect( contours ).toHaveLength( 2 );
        expect( contours[ 0 ] ).toHaveLength( 2 );
        expect( contours[ 1 ] ).toHaveLength( 2 );
      }
    );
  }
);

describe(
  "resampleContour",
  () => {
    it(
      "produces evenly spaced samples around a closed square",
      () => {
        const square: Point[] = [
          {
            x: 0,
            y: 0
          },
          {
            x: 10,
            y: 0
          },
          {
            x: 10,
            y: 10
          },
          {
            x: 0,
            y: 10
          }
        ];

        const samples = resampleContour(
          square,
          1,
          true
        );

        // Perimeter is 40, spacing 1 → ~40 samples, none duplicated at the seam.
        expect( samples.length ).toBeGreaterThan( 30 );

        const gaps = spacingsOf(
          samples,
          true
        );
        const min = Math.min( ...gaps );
        const max = Math.max( ...gaps );

        // Even spacing: every gap within a hair of the mean.
        expect( max - min ).toBeLessThan( 0.2 );
      }
    );

    it(
      "keeps both endpoints for an open contour",
      () => {
        const line: Point[] = [
          {
            x: 0,
            y: 0
          },
          {
            x: 9,
            y: 0
          }
        ];

        const samples = resampleContour(
          line,
          3,
          false
        );

        expect( samples[ 0 ] ).toEqual( {
          x: 0,
          y: 0
        } );
        expect( samples[ samples.length - 1 ].x ).toBeCloseTo( 9 );
      }
    );

    it(
      "degrades gracefully for trivial input",
      () => {
        expect( resampleContour(
          [],
          1,
          true
        ) ).toEqual( [] );
        expect( resampleContour(
          [
            {
              x: 3,
              y: 4
            }
          ],
          1,
          true
        ) ).toEqual( [
          {
            x: 3,
            y: 4
          }
        ] );
      }
    );
  }
);

describe(
  "rotateContour",
  () => {
    const ring: Point[] = [
      {
        x: 0,
        y: 0
      },
      {
        x: 1,
        y: 0
      },
      {
        x: 2,
        y: 0
      },
      {
        x: 3,
        y: 0
      }
    ];

    it(
      "is a no-op at offset 0",
      () => {
        expect( rotateContour(
          ring,
          0
        ) ).toEqual( ring );
      }
    );

    it(
      "moves the start point without dropping any vertex",
      () => {
        const rotated = rotateContour(
          ring,
          0.5
        );

        expect( rotated ).toHaveLength( ring.length );
        expect( rotated[ 0 ] ).toEqual( {
          x: 2,
          y: 0
        } );
        // Same set of points, just reordered.
        expect( [
          ...rotated
        ].sort( (
          a, b
        ) => a.x - b.x ) ).toEqual( ring );
      }
    );
  }
);

describe(
  "hashedRandom",
  () => {
    it(
      "is deterministic and within [0, 1)",
      () => {
        for ( let seed = 0; seed < 50; seed++ ) {
          const value = hashedRandom( seed );

          expect( value ).toBeGreaterThanOrEqual( 0 );
          expect( value ).toBeLessThan( 1 );
          expect( hashedRandom( seed ) ).toBe( value );
        }
      }
    );

    it(
      "spreads different seeds across the range",
      () => {
        const values = Array.from(
          {
            length: 32
          },
          (
            _, i
          ) => hashedRandom( i )
        );
        const unique = new Set( values.map( ( v ) => Math.round( v * 10 ) ) );

        // Not all clustered in one bucket.
        expect( unique.size ).toBeGreaterThan( 4 );
      }
    );
  }
);
