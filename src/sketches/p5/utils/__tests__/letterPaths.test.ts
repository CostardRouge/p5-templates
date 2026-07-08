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
  hashedRandom,
  tangentHeadings,
  sampleHeading,
  lerpAngle,
  smoothAngles
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

describe(
  "tangentHeadings",
  () => {
    function circle( n: number ): Point[] {
      return Array.from(
        {
          length: n
        },
        (
          _, i
        ) => ( {
          x: Math.cos( 2 * Math.PI * i / n ),
          y: Math.sin( 2 * Math.PI * i / n )
        } )
      );
    }

    it(
      "degrades gracefully for trivial input",
      () => {
        expect( tangentHeadings(
          [],
          0
        ) ).toEqual( [] );
        expect( tangentHeadings(
          [
            {
              x: 1,
              y: 2
            }
          ],
          0
        ) ).toEqual( [
          0
        ] );
      }
    );

    it(
      "unwraps into a continuous run with no ±π flips around a ring",
      () => {
        const headings = tangentHeadings(
          circle( 48 ),
          0
        );

        // No raw atan2 wrap survives: every neighbour step stays well under π.
        for ( let i = 1; i < headings.length; i++ ) {
          expect( Math.abs( headings[ i ] - headings[ i - 1 ] ) )
            .toBeLessThan( Math.PI );
        }

        // One full turn of winding is accumulated over the loop (the property
        // that lets the world rotate smoothly to follow the pen).
        const total = headings[ headings.length - 1 ] - headings[ 0 ];

        expect( Math.abs( total ) ).toBeCloseTo(
          2 * Math.PI * 47 / 48,
          1
        );
      }
    );

    it(
      "smoothing keeps the series continuous and endpoints fixed",
      () => {
        const raw = tangentHeadings(
          circle( 48 ),
          0
        );
        const smooth = tangentHeadings(
          circle( 48 ),
          2
        );

        expect( smooth[ 0 ] ).toBeCloseTo( raw[ 0 ] );
        expect( smooth[ smooth.length - 1 ] )
          .toBeCloseTo( raw[ raw.length - 1 ] );

        for ( let i = 1; i < smooth.length; i++ ) {
          expect( Math.abs( smooth[ i ] - smooth[ i - 1 ] ) )
            .toBeLessThan( Math.PI );
        }
      }
    );
  }
);

describe(
  "sampleHeading",
  () => {
    const headings = [
      0,
      1,
      2,
      3
    ];

    it(
      "reads the endpoints and lerps between samples",
      () => {
        expect( sampleHeading(
          headings,
          0
        ) ).toBeCloseTo( 0 );
        expect( sampleHeading(
          headings,
          1
        ) ).toBeCloseTo( 3 );
        // pos = 0.5 × (4 - 1) = 1.5 → halfway between headings[1] and headings[2].
        expect( sampleHeading(
          headings,
          0.5
        ) ).toBeCloseTo( 1.5 );
      }
    );

    it(
      "aims look-ahead samples further along and clamps at the end",
      () => {
        expect( sampleHeading(
          headings,
          0,
          1
        ) ).toBeCloseTo( 1 );
        // Look-ahead past the final sample clamps rather than running off.
        expect( sampleHeading(
          headings,
          1,
          5
        ) ).toBeCloseTo( 3 );
      }
    );

    it(
      "degrades gracefully for trivial input",
      () => {
        expect( sampleHeading(
          [],
          0.5
        ) ).toBe( 0 );
        expect( sampleHeading(
          [
            7
          ],
          0.5
        ) ).toBe( 7 );
      }
    );
  }
);

describe(
  "lerpAngle",
  () => {
    it(
      "interpolates the short way when angles straddle ±π",
      () => {
        // 3.0 → -3.0 the naive way sweeps -6 rad; the short way is +0.28 across
        // the seam, landing near ±π at the midpoint.
        expect( Math.abs( lerpAngle(
          3,
          -3,
          0.5
        ) ) ).toBeCloseTo( Math.PI );
      }
    );

    it(
      "is a plain lerp well away from the seam",
      () => {
        expect( lerpAngle(
          0,
          Math.PI / 2,
          0.5
        ) ).toBeCloseTo( Math.PI / 4 );
      }
    );
  }
);

describe(
  "smoothAngles",
  () => {
    it(
      "returns a copy untouched when there is nothing to smooth",
      () => {
        const values = [
          1,
          2
        ];
        const out = smoothAngles(
          values,
          3
        );

        expect( out ).toEqual( values );
        expect( out ).not.toBe( values );
      }
    );

    it(
      "averages interior values while pinning the endpoints",
      () => {
        const out = smoothAngles(
          [
            0,
            9,
            0
          ],
          1
        );

        expect( out[ 0 ] ).toBe( 0 );
        expect( out[ 2 ] ).toBe( 0 );
        expect( out[ 1 ] ).toBeCloseTo( 3 );
      }
    );
  }
);
