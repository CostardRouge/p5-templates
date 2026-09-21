/**
 * Unit tests for the sculpt category's shared geometry and wave.
 *
 * Both modules are pure functions of their inputs (no p5, no Math.random), and
 * the sketches rely on exactly that: the same options must give the same
 * lattice in the studio and in deterministic capture, links must never rewire
 * as points move, and the wave must close on the loop.
 */
import {
  MAX_LINKS,
  MAX_POINTS,
  buildLinks,
  buildPoints,
  driftAt,
  getLattice,
  valueNoise3
} from "@/p5/sketches/sculpt/_lattice.js";
import {
  WAVE_MODES,
  envelopeAt,
  envelopeTimings,
  linkStateAt,
  rankAt,
  wavePhase
} from "@/p5/sketches/sculpt/_wave.js";

type Pt = { x: number;
  y: number;
  z: number;
  id: number };

const dist = (
  a: Pt, b: Pt
) => Math.hypot(
  a.x - b.x,
  a.y - b.y,
  a.z - b.z
);

const minPairDistance = ( points: Pt[] ) => {
  let best = Infinity;

  for ( let i = 0; i < points.length; i++ ) {
    for ( let j = i + 1; j < points.length; j++ ) {
      best = Math.min(
        best,
        dist(
          points[ i ],
          points[ j ]
        )
      );
    }
  }

  return best;
};

describe(
  "buildPoints",
  () => {
    const base = {
      count: 40,
      seed: 7,
      spacing: 0.6,
      volume: "sphere",
      flatten: 0.35
    };

    it(
      "is deterministic for a seed and different for another",
      () => {
        const a = buildPoints( base );
        const b = buildPoints( base );
        const c = buildPoints( {
          ...base,
          seed: 8
        } );

        expect( a ).toEqual( b );
        expect( a ).not.toEqual( c );
        expect( a ).toHaveLength( 40 );
      }
    );

    it(
      "always yields the requested count, even at full spacing",
      () => {
        for ( const volume of [
          "sphere",
          "box",
          "disc",
          "shell"
        ] ) {
          expect( buildPoints( {
            ...base,
            volume,
            spacing: 1,
            count: MAX_POINTS
          } ) ).toHaveLength( MAX_POINTS );
        }
      }
    );

    it(
      "spacing raises the closest pair distance",
      () => {
        const loose = minPairDistance( buildPoints( {
          ...base,
          spacing: 0
        } ) );
        const even = minPairDistance( buildPoints( {
          ...base,
          spacing: 1
        } ) );

        expect( even ).toBeGreaterThan( loose );
      }
    );

    it(
      "stays inside the unit volume and honours flatten",
      () => {
        const points = buildPoints( base );

        for ( const pt of points ) {
          expect( Math.hypot(
            pt.x,
            pt.y,
            pt.z
          ) ).toBeLessThanOrEqual( 1.0001 );
          expect( Math.abs( pt.z ) ).toBeLessThanOrEqual( 0.35 + 1e-9 );
        }

        const disc = buildPoints( {
          ...base,
          volume: "disc",
          flatten: 1
        } );

        expect( disc.every( ( pt ) => pt.z === 0 ) ).toBe( true );
      }
    );
  }
);

describe(
  "buildLinks",
  () => {
    const points = buildPoints( {
      count: 40,
      seed: 7,
      spacing: 0.6,
      volume: "sphere",
      flatten: 0.35
    } );

    it(
      "links every point to its nearest neighbours, once per pair, within reach",
      () => {
        const links = buildLinks(
          points,
          {
            neighbours: 2,
            reach: 0.7,
            density: 1,
            seed: 7
          }
        );
        const keys = new Set( links.map( ( link ) => `${ link.a }-${ link.b }` ) );

        expect( keys.size ).toBe( links.length );
        expect( links.every( ( link ) => link.a < link.b ) ).toBe( true );
        expect( links.every( ( link ) => link.length <= 0.7 ) ).toBe( true );
        expect( links.every( ( link ) => link.u >= 0 && link.u < 1 ) ).toBe( true );
        expect( links.map( ( link ) => link.id ) ).toEqual( links.map( (
          _, i
        ) => i ) );

        // Every point's single nearest neighbour is linked to it.
        points.forEach( (
          pt, i
        ) => {
          let nearest = -1;
          let best = Infinity;

          points.forEach( (
            other, j
          ) => {
            const d = dist(
              pt,
              other
            );

            if ( j !== i && d < best ) {
              best = d;
              nearest = j;
            }
          } );

          if ( best <= 0.7 ) {
            expect( keys.has( `${ Math.min(
              i,
              nearest
            ) }-${ Math.max(
              i,
              nearest
            ) }` ) ).toBe( true );
          }
        } );
      }
    );

    it(
      "density thins the graph and the cap keeps the shortest links",
      () => {
        const full = buildLinks(
          points,
          {
            neighbours: 4,
            reach: 2,
            density: 1,
            seed: 7
          }
        );
        const half = buildLinks(
          points,
          {
            neighbours: 4,
            reach: 2,
            density: 0.5,
            seed: 7
          }
        );
        const crowded = buildLinks(
          buildPoints( {
            count: MAX_POINTS,
            seed: 3,
            spacing: 0.5,
            volume: "box",
            flatten: 1
          } ),
          {
            neighbours: 6,
            reach: 4,
            density: 1,
            seed: 3
          }
        );

        expect( half.length ).toBeLessThan( full.length );
        expect( crowded ).toHaveLength( MAX_LINKS );

        const longest = Math.max( ...crowded.map( ( link ) => link.length ) );

        // Nothing dropped is shorter than what was kept: the cap trims the
        // longest links, so the graph stays local.
        expect( longest ).toBeLessThan( 4 );
      }
    );

    it(
      "getLattice memoises on its parameters",
      () => {
        const cfg = {
          count: 12,
          seed: 1,
          spacing: 0.5,
          volume: "disc",
          flatten: 0,
          neighbours: 2,
          reach: 1,
          density: 1
        };

        expect( getLattice( cfg ) ).toBe( getLattice( {
          ...cfg
        } ) );
        expect( getLattice( cfg ) ).not.toBe( getLattice( {
          ...cfg,
          seed: 2
        } ) );
      }
    );
  }
);

describe(
  "drift and noise",
  () => {
    const pt = {
      x: 0.3,
      y: -0.2,
      z: 0.1,
      id: 0
    };
    const cfg = {
      amplitude: 0.1,
      cycles: 2,
      scale: 1.2,
      seed: 7
    };

    it(
      "valueNoise3 stays in [0, 1] and is continuous",
      () => {
        let previous = valueNoise3(
          0,
          0,
          0,
          7
        );

        for ( let i = 1; i <= 200; i++ ) {
          const value = valueNoise3(
            i * 0.02,
            i * 0.013,
            i * 0.007,
            7
          );

          expect( value ).toBeGreaterThanOrEqual( 0 );
          expect( value ).toBeLessThanOrEqual( 1 );
          expect( Math.abs( value - previous ) ).toBeLessThan( 0.15 );
          previous = value;
        }
      }
    );

    it(
      "driftAt closes on the loop, is bounded by the amplitude and is zero without one",
      () => {
        const start = driftAt(
          pt,
          0,
          cfg
        );
        const end = driftAt(
          pt,
          1,
          cfg
        );
        const mid = driftAt(
          pt,
          0.37,
          cfg
        );

        start.forEach( (
          v, i
        ) => expect( v ).toBeCloseTo(
          end[ i ],
          9
        ) );
        expect( mid ).not.toEqual( start );
        mid.forEach( ( v ) => expect( Math.abs( v ) ).toBeLessThanOrEqual( 0.1 ) );
        expect( driftAt(
          pt,
          0.5,
          {
            ...cfg,
            amplitude: 0
          }
        ) ).toEqual( [
          0,
          0,
          0
        ] );
      }
    );
  }
);

describe(
  "rankAt",
  () => {
    const at = (
      x: number, y: number, z: number
    ) => ( {
      x,
      y,
      z
    } );

    it(
      "puts every mode's source at rank 0 and its far end at rank 1",
      () => {
        const cases: Array<[string, Pt | { x: number;
          y: number;
          z: number }, { x: number;
          y: number;
          z: number }]> = [
          [
            "radial-out",
            at(
              0,
              0,
              0
            ),
            at(
              1,
              0,
              0
            )
          ],
          [
            "radial-in",
            at(
              0,
              1,
              0
            ),
            at(
              0,
              0,
              0
            )
          ],
          [
            "left-right",
            at(
              -1,
              0,
              0
            ),
            at(
              1,
              0,
              0
            )
          ],
          [
            "right-left",
            at(
              1,
              0,
              0
            ),
            at(
              -1,
              0,
              0
            )
          ],
          [
            "top-down",
            at(
              0,
              1,
              0
            ),
            at(
              0,
              -1,
              0
            )
          ],
          [
            "bottom-up",
            at(
              0,
              -1,
              0
            ),
            at(
              0,
              1,
              0
            )
          ],
          [
            "front-back",
            at(
              0,
              0,
              -1
            ),
            at(
              0,
              0,
              1
            )
          ],
          [
            "back-front",
            at(
              0,
              0,
              1
            ),
            at(
              0,
              0,
              -1
            )
          ],
          [
            "diagonal",
            at(
              -1,
              -1,
              0
            ),
            at(
              1,
              1,
              0
            )
          ]
        ];

        for ( const [
          mode,
          source,
          far
        ] of cases ) {
          expect( rankAt(
            source,
            mode
          ) ).toBeCloseTo(
            0,
            9
          );
          expect( rankAt(
            far,
            mode
          ) ).toBeCloseTo(
            1,
            9
          );
        }
      }
    );

    it(
      "cursor mode ranks from the cursor, and from the centre without one",
      () => {
        const cursor = at(
          0.5,
          0.5,
          0
        );

        expect( rankAt(
          cursor,
          "cursor",
          {
            cursor
          }
        ) ).toBe( 0 );
        expect( rankAt(
          at(
            -0.5,
            -0.5,
            0
          ),
          "cursor",
          {
            cursor
          }
        ) ).toBeGreaterThan( 0.5 );
        expect( rankAt(
          at(
            0,
            0,
            0
          ),
          "cursor"
        ) ).toBe( 0 );
      }
    );

    it(
      "every mode stays in [0, 1], random is seeded, jitter is bounded",
      () => {
        const pt = at(
          0.4,
          -0.7,
          0.2
        );

        for ( const mode of WAVE_MODES ) {
          const rank = rankAt(
            pt,
            mode,
            {
              id: 5,
              seed: 7,
              jitter: 1
            }
          );

          expect( rank ).toBeGreaterThanOrEqual( 0 );
          expect( rank ).toBeLessThanOrEqual( 1 );
        }

        expect( rankAt(
          pt,
          "random",
          {
            id: 5,
            seed: 7
          }
        ) ).toBe( rankAt(
          pt,
          "random",
          {
            id: 5,
            seed: 7
          }
        ) );
        expect( rankAt(
          pt,
          "random",
          {
            id: 5,
            seed: 7
          }
        ) ).not.toBe( rankAt(
          pt,
          "random",
          {
            id: 6,
            seed: 7
          }
        ) );
      }
    );
  }
);

describe(
  "wave envelope",
  () => {
    const timings = envelopeTimings( {
      rise: 0.25,
      hold: 0.2
    } );

    it(
      "wavePhase closes on the loop and is continuous across the wrap",
      () => {
        expect( wavePhase(
          0,
          2,
          0.3,
          1
        ) ).toBeCloseTo(
          wavePhase(
            1,
            2,
            0.3,
            1
          ),
          9
        );
        expect( wavePhase(
          0.999,
          2,
          0.3,
          1
        ) ).toBeCloseTo(
          ( wavePhase(
            0.001,
            2,
            0.3,
            1
          ) - 0.004 + 1 ) % 1,
          6
        );
      }
    );

    it(
      "timings fit one cycle, shortening the hold first",
      () => {
        expect( timings ).toEqual( {
          rise: 0.25,
          hold: 0.2,
          active: 0.7
        } );
        const squeezed = envelopeTimings( {
          rise: 0.4,
          hold: 0.9
        } );

        expect( squeezed.rise ).toBe( 0.4 );
        expect( squeezed.hold ).toBeCloseTo(
          0.2,
          9
        );
        expect( squeezed.active ).toBeCloseTo(
          1,
          9
        );
      }
    );

    it(
      "poses from the source, holds, withdraws, then is absent",
      () => {
        const at = ( phase: number ) => envelopeAt(
          phase,
          timings
        );

        expect( at( 0 ) ).toEqual( {
          head: 0,
          tail: 0,
          bump: 0
        } );
        expect( at( 0.125 ).head ).toBeCloseTo(
          0.5,
          9
        );
        expect( at( 0.3 ) ).toMatchObject( {
          head: 1,
          tail: 0
        } );
        expect( at( 0.575 ).tail ).toBeCloseTo(
          0.5,
          9
        );
        expect( at( 0.35 ).bump ).toBeCloseTo(
          1,
          9
        );
        expect( at( 0.85 ) ).toMatchObject( {
          head: 1,
          tail: 1,
          bump: 0
        } );
      }
    );

    it(
      "linkStateAt maps the envelope onto each effect",
      () => {
        const posing = envelopeAt(
          0.125,
          timings
        );
        const dark = envelopeAt(
          0.85,
          timings
        );

        expect( linkStateAt(
          "grow",
          posing,
          0.8
        ) ).toEqual( {
          present: true,
          head: 0.5,
          tail: 0,
          radius: 1
        } );
        expect( linkStateAt(
          "grow",
          dark,
          0.8
        ).present ).toBe( false );
        expect( linkStateAt(
          "grow-swell",
          dark,
          0.8
        ).present ).toBe( false );
        expect( linkStateAt(
          "swell",
          dark,
          0.8
        ) ).toEqual( {
          present: true,
          head: 1,
          tail: 0,
          radius: 1
        } );
        expect( linkStateAt(
          "swell",
          envelopeAt(
            0.35,
            timings
          ),
          0.8
        ).radius ).toBeCloseTo(
          1.8,
          9
        );
        expect( linkStateAt(
          "reveal",
          posing,
          0.8
        ) ).toMatchObject( {
          present: true,
          head: 1,
          tail: 0,
          radius: 0.5
        } );
        expect( linkStateAt(
          "reveal",
          dark,
          0.8
        ).present ).toBe( false );
        expect( linkStateAt(
          "none",
          dark,
          0.8
        ) ).toEqual( {
          present: true,
          head: 1,
          tail: 0,
          radius: 1
        } );
      }
    );
  }
);
