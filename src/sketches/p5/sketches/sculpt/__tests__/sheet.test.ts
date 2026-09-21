/**
 * The SHEET's logic (`_sheet.js`, the grid-shaped sculpt — `sculpt.test.ts`
 * covers the lattice-shaped one) is what decides which points rise, when, and
 * which tubes may join them. Every claim the sketch makes about readability
 * and loop closure is a property of these functions, so it is checked here on
 * a synthetic ring mask (an "o": ink between two radii, a hole in the middle)
 * with no canvas involved.
 */

import {
  HEIGHT_MAX,
  HEIGHT_MIN,
  MAX_OFFSET,
  WEIGHT_MAX,
  buildGrid,
  computeHeights,
  cursorField,
  driftOffsets,
  cellHash01,
  linkWeights,
  orderValues,
  packField,
  textUnits,
  unpackHeight,
  valueNoise2
} from "../_sheet.js";

const ASPECT = 1;

// The "o": ink where the distance to the centre is between the two radii.
function ringInk(
  u: number, v: number
): number {
  const d = Math.hypot(
    u - 0.5,
    v - 0.5
  );

  return d > 0.15 && d < 0.4 ? 1 : 0;
}

function ringTargets( grid: ReturnType<typeof buildGrid> ): Float32Array {
  const target = new Float32Array( grid.count );

  for ( let n = 0; n < grid.count; n++ ) {
    target[ n ] = ringInk(
      grid.u[ n ],
      grid.v[ n ]
    );
  }

  return target;
}

function inHole(
  u: number, v: number
): boolean {
  return Math.hypot(
    u - 0.5,
    v - 0.5
  ) <= 0.15;
}

const linear = ( x: number ) => x;

describe(
  "buildGrid",
  () => {
    it(
      "keeps every point inside its own cell and is deterministic in the seed",
      () => {
        const a = buildGrid( {
          cols: 24,
          aspect: 0.8,
          jitter: 0.6,
          seed: 3
        } );
        const b = buildGrid( {
          cols: 24,
          aspect: 0.8,
          jitter: 0.6,
          seed: 3
        } );
        const c = buildGrid( {
          cols: 24,
          aspect: 0.8,
          jitter: 0.6,
          seed: 4
        } );

        expect( a.rows ).toBe( 30 );
        expect( a.count ).toBe( 24 * 30 );
        expect( Array.from( a.jx ) ).toEqual( Array.from( b.jx ) );
        expect( Array.from( a.jx ) ).not.toEqual( Array.from( c.jx ) );

        for ( let n = 0; n < a.count; n++ ) {
          expect( Math.abs( a.jx[ n ] ) ).toBeLessThanOrEqual( MAX_OFFSET );
          expect( Math.abs( a.jz[ n ] ) ).toBeLessThanOrEqual( MAX_OFFSET );
        }
      }
    );

    it(
      "hex layout shifts odd rows by half a cell",
      () => {
        const hex = buildGrid( {
          cols: 10,
          jitter: 0,
          layout: "hex"
        } );

        expect( hex.jx[ 0 ] ).toBe( 0 );
        expect( hex.jx[ 10 ] ).toBeCloseTo(
          MAX_OFFSET,
          6
        );
      }
    );
  }
);

describe(
  "cellHash01 / valueNoise2",
  () => {
    it(
      "stay in range and repeat exactly",
      () => {
        for ( let k = 0; k < 200; k++ ) {
          const h = cellHash01(
            k,
            k * 7,
            11
          );
          const n = valueNoise2(
            k * 0.37,
            k * 0.11,
            5
          );

          expect( h ).toBeGreaterThanOrEqual( 0 );
          expect( h ).toBeLessThan( 1 );
          expect( n ).toBeGreaterThanOrEqual( 0 );
          expect( n ).toBeLessThanOrEqual( 1 );
        }

        expect( valueNoise2(
          1.3,
          2.7,
          9
        ) ).toBe( valueNoise2(
          1.3,
          2.7,
          9
        ) );
      }
    );
  }
);

describe(
  "driftOffsets",
  () => {
    it(
      "closes the loop and never leaves the cell",
      () => {
        const grid = buildGrid( {
          cols: 16,
          jitter: 0.4,
          seed: 2
        } );
        const x0 = new Float32Array( grid.count );
        const z0 = new Float32Array( grid.count );
        const x1 = new Float32Array( grid.count );
        const z1 = new Float32Array( grid.count );
        const xm = new Float32Array( grid.count );
        const zm = new Float32Array( grid.count );
        const opts = {
          amount: 0.4,
          scale: 2,
          cycles: 2,
          seed: 2
        };

        driftOffsets(
          grid,
          {
            ...opts,
            progression: 0
          },
          x0,
          z0
        );
        driftOffsets(
          grid,
          {
            ...opts,
            progression: 1
          },
          x1,
          z1
        );
        driftOffsets(
          grid,
          {
            ...opts,
            progression: 0.4
          },
          xm,
          zm
        );

        for ( let n = 0; n < grid.count; n++ ) {
          expect( x0[ n ] ).toBeCloseTo(
            x1[ n ],
            5
          );
          expect( z0[ n ] ).toBeCloseTo(
            z1[ n ],
            5
          );
          expect( Math.abs( xm[ n ] ) ).toBeLessThanOrEqual( MAX_OFFSET );
          expect( Math.abs( zm[ n ] ) ).toBeLessThanOrEqual( MAX_OFFSET );
        }

        let moved = 0;

        for ( let n = 0; n < grid.count; n++ ) {
          moved += Math.abs( xm[ n ] - x0[ n ] );
        }

        expect( moved ).toBeGreaterThan( 1 );
      }
    );
  }
);

describe(
  "orderValues",
  () => {
    const grid = buildGrid( {
      cols: 30,
      jitter: 0,
      seed: 1
    } );
    const target = ringTargets( grid );

    it(
      "spans 0..1 over the raised points and stays 0 elsewhere",
      () => {
        const order = orderValues(
          grid,
          target,
          {
            mode: "reading"
          }
        );
        let min = Infinity;
        let max = -Infinity;

        for ( let n = 0; n < grid.count; n++ ) {
          if ( target[ n ] > 0 ) {
            min = Math.min(
              min,
              order[ n ]
            );
            max = Math.max(
              max,
              order[ n ]
            );
          } else {
            expect( order[ n ] ).toBe( 0 );
          }
        }

        // Float32 storage: exact to a few 1e-8.
        expect( min ).toBeCloseTo(
          0,
          5
        );
        expect( max ).toBeCloseTo(
          1,
          5
        );
      }
    );

    it(
      "radial-out lifts the inner rim of the ring before the outer rim, radial-in the reverse",
      () => {
        const out = orderValues(
          grid,
          target,
          {
            mode: "radial-out"
          }
        );
        const inward = orderValues(
          grid,
          target,
          {
            mode: "radial-in"
          }
        );
        let inner = -1;
        let outer = -1;

        for ( let n = 0; n < grid.count; n++ ) {
          if ( target[ n ] <= 0 ) {
            continue;
          }

          const d = Math.hypot(
            grid.u[ n ] - 0.5,
            grid.v[ n ] - 0.5
          );

          if ( inner < 0 && d < 0.2 ) {
            inner = n;
          }

          if ( outer < 0 && d > 0.36 ) {
            outer = n;
          }
        }

        expect( out[ inner ] ).toBeLessThan( out[ outer ] );
        expect( inward[ inner ] ).toBeGreaterThan( inward[ outer ] );
      }
    );

    it(
      "a sweep at angle 0 goes left to right, at π/2 top to bottom",
      () => {
        const across = orderValues(
          grid,
          target,
          {
            mode: "sweep",
            angle: 0
          }
        );
        const down = orderValues(
          grid,
          target,
          {
            mode: "sweep",
            angle: Math.PI / 2
          }
        );
        // Middle row / middle column of the 30×30 grid, on the ring's ink.
        const left = 15 * 30 + 5;
        const right = 15 * 30 + 24;
        const top = 5 * 30 + 15;
        const bottom = 24 * 30 + 15;

        expect( target[ left ] ).toBe( 1 );
        expect( target[ right ] ).toBe( 1 );
        expect( target[ top ] ).toBe( 1 );
        expect( target[ bottom ] ).toBe( 1 );

        expect( across[ left ] ).toBeLessThan( across[ right ] );
        expect( down[ top ] ).toBeLessThan( down[ bottom ] );
      }
    );
  }
);

describe(
  "computeHeights",
  () => {
    const grid = buildGrid( {
      cols: 20,
      jitter: 0,
      seed: 1
    } );
    const ring = ringTargets( grid );
    const disc = new Float32Array( grid.count );
    const empty = new Float32Array( grid.count );

    for ( let n = 0; n < grid.count; n++ ) {
      disc[ n ] = Math.hypot(
        grid.u[ n ] - 0.5,
        grid.v[ n ] - 0.5
      ) < 0.3 ? 1 : 0;
    }

    const mk = ( target: Float32Array ) => ( {
      target,
      order: orderValues(
        grid,
        target,
        {
          mode: "radial-out"
        }
      )
    } );
    const units = [
      mk( ring ),
      mk( disc ),
      mk( empty )
    ];
    const rhythm = ( transition: string ) => ( {
      hold: 0.4,
      transition,
      rise: {
        spread: 0.5,
        ease: linear
      },
      fall: {
        spread: 0.5,
        ease: linear,
        mirror: true
      }
    } );
    const out = new Float32Array( grid.count );

    it(
      "holds the unit at its target during the hold",
      () => {
        const stage = computeHeights(
          units,
          0.2,
          rhythm( "morph" ),
          out
        );

        expect( stage.current ).toBe( 0 );
        expect( stage.q ).toBe( 0 );
        expect( Array.from( out ) ).toEqual( Array.from( ring ) );
      }
    );

    it(
      "sequential: everything is down halfway through the handover",
      () => {
        computeHeights(
          units,
          0.4 + 0.6 * 0.5,
          rhythm( "sequential" ),
          out
        );

        for ( let n = 0; n < grid.count; n++ ) {
          expect( out[ n ] ).toBeCloseTo(
            0,
            6
          );
        }
      }
    );

    it(
      "morph keeps a point shared by both units up through the handover",
      () => {
        // A point on the ring that is also inside the disc.
        let shared = -1;
        let ringOnly = -1;

        for ( let n = 0; n < grid.count; n++ ) {
          if ( ring[ n ] > 0 && disc[ n ] > 0 && shared < 0 ) {
            shared = n;
          }

          if ( ring[ n ] > 0 && disc[ n ] === 0 && ringOnly < 0 ) {
            ringOnly = n;
          }
        }

        expect( shared ).toBeGreaterThanOrEqual( 0 );
        expect( ringOnly ).toBeGreaterThanOrEqual( 0 );

        for ( const t of [
          0.5,
          0.7,
          0.9
        ] ) {
          computeHeights(
            units,
            t,
            rhythm( "morph" ),
            out
          );
          expect( out[ shared ] ).toBeCloseTo(
            1,
            6
          );
          expect( out[ ringOnly ] ).toBeLessThan( 1 );
        }

        // The crossfade dips the shared point instead.
        computeHeights(
          units,
          0.7,
          rhythm( "crossfade" ),
          out
        );
        expect( out[ shared ] ).toBeLessThan( 1 );
      }
    );

    it(
      "wraps at the unit count, so the loop closes on the first unit",
      () => {
        const a = new Float32Array( grid.count );
        const b = new Float32Array( grid.count );

        computeHeights(
          units,
          0,
          rhythm( "morph" ),
          a
        );
        computeHeights(
          units,
          units.length,
          rhythm( "morph" ),
          b
        );

        expect( Array.from( a ) ).toEqual( Array.from( b ) );
      }
    );
  }
);

describe(
  "linkWeights",
  () => {
    const grid = buildGrid( {
      cols: 24,
      jitter: 0.3,
      seed: 5
    } );
    const heights = ringTargets( grid );
    const offX = Float32Array.from( grid.jx );
    const offZ = Float32Array.from( grid.jz );
    const out = new Uint8Array( grid.count * 4 );

    function midpointOf(
      n: number, d: number
    ): [ number, number ] {
      const dirs = [
        [
          1,
          0
        ],
        [
          0,
          1
        ],
        [
          1,
          1
        ],
        [
          -1,
          1
        ]
      ];
      const i = n % grid.cols;
      const j = ( n - i ) / grid.cols;
      const ii = i + dirs[ d ][ 0 ];
      const jj = j + dirs[ d ][ 1 ];
      const m = jj * grid.cols + ii;

      return [
        ( i + ii + 1 + offX[ n ] + offX[ m ] ) / ( 2 * grid.cols ),
        ( j + jj + 1 + offZ[ n ] + offZ[ m ] ) / ( 2 * grid.rows )
      ];
    }

    it(
      "with the ink rule, no weighted link has its midpoint in the hole of the o",
      () => {
        linkWeights(
          grid,
          heights,
          offX,
          offZ,
          {
            reach: 8,
            rule: "ink",
            inkAt: ringInk
          },
          out
        );

        let weighted = 0;

        for ( let n = 0; n < grid.count; n++ ) {
          for ( let d = 0; d < 4; d++ ) {
            const byte = out[ n * 4 + d ];

            if ( byte > 1 ) {
              weighted++;

              const [
                mu,
                mv
              ] = midpointOf(
                n,
                d
              );

              expect( inHole(
                mu,
                mv
              ) ).toBe( false );
            }
          }
        }

        expect( weighted ).toBeGreaterThan( 50 );
      }
    );

    it(
      "the endpoints rule lets links cross a counter thinner than a cell; the ink rule never does",
      () => {
        // Ink everywhere but a pinhole at the centre, narrower than one cell
        // of a 10-wide grid: the two points either side of it are raised
        // neighbours, and the link between them has its midpoint in the hole.
        const pinholeInk = (
          u: number, v: number
        ) => ( Math.hypot(
          u - 0.5,
          v - 0.5
        ) > 0.04 ? 1 : 0 );
        const coarse = buildGrid( {
          cols: 10,
          jitter: 0,
          seed: 1
        } );
        const h = new Float32Array( coarse.count );

        for ( let n = 0; n < coarse.count; n++ ) {
          h[ n ] = pinholeInk(
            coarse.u[ n ],
            coarse.v[ n ]
          );
        }

        const zero = new Float32Array( coarse.count );
        const bytes = new Uint8Array( coarse.count * 4 );
        const countCrossing = () => {
          let crossing = 0;

          for ( let n = 0; n < coarse.count; n++ ) {
            const i = n % coarse.cols;
            const j = ( n - i ) / coarse.cols;

            for ( let d = 0; d < 4; d++ ) {
              if ( bytes[ n * 4 + d ] <= 1 ) {
                continue;
              }

              const ii = i + [
                1,
                0,
                1,
                -1
              ][ d ];
              const jj = j + [
                0,
                1,
                1,
                1
              ][ d ];

              if ( !pinholeInk(
                ( i + ii + 1 ) / ( 2 * coarse.cols ),
                ( j + jj + 1 ) / ( 2 * coarse.rows )
              ) ) {
                crossing++;
              }
            }
          }

          return crossing;
        };

        linkWeights(
          coarse,
          h,
          zero,
          zero,
          {
            reach: 8,
            rule: "endpoints"
          },
          bytes
        );
        expect( countCrossing() ).toBeGreaterThan( 0 );

        linkWeights(
          coarse,
          h,
          zero,
          zero,
          {
            reach: 8,
            rule: "ink",
            inkAt: pinholeInk
          },
          bytes
        );
        expect( countCrossing() ).toBe( 0 );
      }
    );

    it(
      "encodes the rest mesh as 1, a full weight as 255, and drops links past maxLength",
      () => {
        const flat = new Float32Array( grid.count );

        linkWeights(
          grid,
          flat,
          offX,
          offZ,
          {
            reach: 4,
            rule: "ink",
            inkAt: ringInk
          },
          out
        );
        // Interior cell: east and south links at rest, no diagonals with reach 4.
        const n = 5 * grid.cols + 5;

        expect( out[ n * 4 ] ).toBe( 1 );
        expect( out[ n * 4 + 1 ] ).toBe( 1 );
        expect( out[ n * 4 + 2 ] ).toBe( 0 );
        expect( out[ n * 4 + 3 ] ).toBe( 0 );

        const full = new Float32Array( grid.count ).fill( WEIGHT_MAX );

        linkWeights(
          grid,
          full,
          offX,
          offZ,
          {
            reach: 8,
            rule: "endpoints"
          },
          out
        );
        expect( out[ n * 4 ] ).toBe( 255 );
        expect( out[ n * 4 + 2 ] ).toBe( 255 );

        // Diagonals are ~1.41 cells long: a maxLength of 1.2 keeps only the
        // orthogonal ones.
        linkWeights(
          grid,
          full,
          new Float32Array( grid.count ),
          new Float32Array( grid.count ),
          {
            reach: 8,
            rule: "endpoints",
            maxLength: 1.2
          },
          out
        );
        expect( out[ n * 4 ] ).toBe( 255 );
        expect( out[ n * 4 + 2 ] ).toBe( 0 );
        expect( out[ n * 4 + 3 ] ).toBe( 0 );
      }
    );
  }
);

describe(
  "packField / unpackHeight",
  () => {
    it(
      "round-trips the height to 16 bits over the whole range",
      () => {
        const grid = buildGrid( {
          cols: 8,
          jitter: 0
        } );
        const offX = new Float32Array( grid.count ).fill( 0.25 );
        const offZ = new Float32Array( grid.count ).fill( -0.5 );
        const heights = new Float32Array( grid.count );
        const out = new Uint8Array( grid.count * 4 );

        for ( let n = 0; n < grid.count; n++ ) {
          heights[ n ] = HEIGHT_MIN + ( ( HEIGHT_MAX - HEIGHT_MIN ) * n ) / ( grid.count - 1 );
        }

        packField(
          grid,
          offX,
          offZ,
          heights,
          out
        );

        const quantum = ( HEIGHT_MAX - HEIGHT_MIN ) / 65535;

        for ( let n = 0; n < grid.count; n++ ) {
          expect( Math.abs( unpackHeight(
            out[ n * 4 + 2 ],
            out[ n * 4 + 3 ]
          ) - heights[ n ] ) ).toBeLessThanOrEqual( quantum );
          expect( out[ n * 4 ] ).toBe( Math.round( 1.25 * 127.5 ) );
          expect( out[ n * 4 + 1 ] ).toBe( Math.round( 0.5 * 127.5 ) );
        }
      }
    );
  }
);

describe(
  "cursorField",
  () => {
    it(
      "is 1 under the cursor, fades to 0 at the radius, and is empty with no cursor",
      () => {
        const grid = buildGrid( {
          cols: 20,
          jitter: 0
        } );
        const zero = new Float32Array( grid.count );
        const out = new Float32Array( grid.count );

        cursorField(
          grid,
          zero,
          zero,
          [],
          0.2,
          linear,
          1,
          out
        );
        expect( Math.max( ...out ) ).toBe( 0 );

        // A cursor exactly on the point in the middle of the grid.
        const centre = 10 * 20 + 10;

        cursorField(
          grid,
          zero,
          zero,
          [
            {
              u: grid.u[ centre ],
              v: grid.v[ centre ]
            }
          ],
          0.2,
          linear,
          1,
          out
        );
        expect( out[ centre ] ).toBeCloseTo(
          1,
          5
        );
        expect( out[ centre + 2 ] ).toBeCloseTo(
          1 - 0.1 / 0.2,
          5
        );
        expect( out[ centre + 5 ] ).toBe( 0 );
      }
    );
  }
);

describe(
  "textUnits",
  () => {
    it(
      "splits by letter with spaces as rests, by word, or keeps the whole text",
      () => {
        expect( textUnits(
          "AB C",
          "letter"
        ) ).toEqual( [
          "A",
          "B",
          "",
          "C"
        ] );
        expect( textUnits(
          " to  be ",
          "word"
        ) ).toEqual( [
          "to",
          "be"
        ] );
        expect( textUnits(
          " to be ",
          "all"
        ) ).toEqual( [
          "to be"
        ] );
        expect( textUnits(
          "",
          "letter"
        ) ).toEqual( [
          ""
        ] );
      }
    );
  }
);
