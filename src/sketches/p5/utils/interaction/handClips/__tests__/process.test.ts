/**
 * Unit tests for the offline hand-clip bake pipeline (`handClips/process.js`):
 * dedupe, zero-phase One-Euro smoothing, uniform Hermite resampling, pinch
 * phase detection and the end-to-end bake of a synthetic pinch-and-drag take.
 */
import fc from "fast-check";

import {
  parseHandClip,
  serializeHandClip
} from "@/p5/shared/handClip.js";

import {
  bakeHandClip,
  createOneEuroFilter,
  dedupeSamples,
  detectPhases,
  deriveAnchors,
  gapSeries,
  resampleUniform,
  smoothSamples
} from "../process.js";

type Point = {
  x: number;
  y: number;
};

type Sample = {
  t: number;
  points: Point[];
};

describe(
  "dedupeSamples",
  () => {
    it(
      "collapses repeat runs to their endpoints and drops non-advancing timestamps",
      () => {
        const at = (
          t: number,
          x: number
        ): Sample => ( {
          t,
          points: [
            {
              x,
              y: 0
            }
          ]
        } );
        const kept = dedupeSamples( [
          at(
            0,
            0.1
          ),
          at(
            0.03,
            0.1
          ), // re-polled inference result — interior of the run
          at(
            0.05,
            0.1
          ), // last repeat — kept, so a held pose keeps its duration
          at(
            0.02,
            0.4
          ), // time went backwards
          at(
            0.08,
            0.2
          )
        ] );

        expect( kept.map( ( sample ) => sample.t ) ).toEqual( [
          0,
          0.05,
          0.08
        ] );
      }
    );

    it(
      "keeps a trailing held pose (run endpoints survive at the take's end)",
      () => {
        const at = (
          t: number,
          x: number
        ): Sample => ( {
          t,
          points: [
            {
              x,
              y: 0
            }
          ]
        } );
        const kept = dedupeSamples(
          [
            at(
              0,
              0.2
            ),
            at(
              0.03,
              0.5
            ),
            at(
              0.06,
              0.5004
            ), // within epsilon of the previous — interior
            at(
              0.09,
              0.5002
            ) // trailing repeat — kept
          ],
          0.001
        );

        expect( kept.map( ( sample ) => sample.t ) ).toEqual( [
          0,
          0.03,
          0.09
        ] );
      }
    );
  }
);

describe(
  "createOneEuroFilter",
  () => {
    it(
      "passes a constant signal through unchanged",
      () => {
        const filter = createOneEuroFilter();

        for ( let i = 0; i < 20; i++ ) {
          expect( filter.step(
            i * 0.02,
            0.42
          ) ).toBeCloseTo(
            0.42,
            9
          );
        }
      }
    );
  }
);

describe(
  "smoothSamples",
  () => {
    // A symmetric triangle: peak exactly at the middle sample.
    const triangle = (): Sample[] => Array.from(
      {
        length: 101
      },
      (
        _, i
      ) => ( {
        t: i * 0.02,
        points: [
          {
            x: 1 - Math.abs( i - 50 ) / 50,
            y: 0
          }
        ]
      } )
    );
    const argmax = ( samples: Sample[] ) => samples.reduce(
      (
        best, sample, index
      ) => ( sample.points[ 0 ].x > samples[ best ].points[ 0 ].x ? index : best ),
      0
    );

    it(
      "keeps a symmetric gesture symmetric (zero-phase pass)",
      () => {
        const smoothed = smoothSamples( triangle() );

        expect( Math.abs( argmax( smoothed ) - 50 ) ).toBeLessThanOrEqual( 2 );
      }
    );

    it(
      "lags like a live filter when zeroPhase is off",
      () => {
        const smoothed = smoothSamples(
          triangle(),
          {
            zeroPhase: false
          }
        );

        expect( argmax( smoothed ) ).toBeGreaterThan( 51 );
      }
    );
  }
);

describe(
  "resampleUniform",
  () => {
    it(
      "reproduces linear motion exactly, for any irregular sampling",
      () => {
        fc.assert( fc.property(
          fc.record( {
            dts: fc.array(
              fc.double( {
                min: 0.01,
                max: 0.3,
                noNaN: true
              } ),
              {
                minLength: 3,
                maxLength: 24
              }
            ),
            a: fc.double( {
              min: -1,
              max: 1,
              noNaN: true
            } ),
            b: fc.double( {
              min: -1,
              max: 1,
              noNaN: true
            } ),
            fps: fc.constantFrom(
              30,
              60
            )
          } ),
          ( {
            dts, a, b, fps
          } ) => {
            let t = 0;
            const samples: Sample[] = dts.map( ( dt ) => {
              t += dt;

              return {
                t,
                points: [
                  {
                    x: a * t + b,
                    y: b - a * t
                  }
                ]
              };
            } );
            const start = samples[ 0 ].t;
            const duration = samples[ samples.length - 1 ].t - start;
            const resampled = resampleUniform(
              samples,
              fps
            );

            for ( let frame = 0; frame < resampled.frameCount; frame++ ) {
              const tf = start + duration * frame / ( resampled.frameCount - 1 );

              expect( Math.abs( resampled.frames[ frame * 2 ] - ( a * tf + b ) ) ).toBeLessThan( 1e-5 );
              expect( Math.abs( resampled.frames[ frame * 2 + 1 ] - ( b - a * tf ) ) ).toBeLessThan( 1e-5 );
            }
          }
        ) );
      }
    );

    it(
      "spans the take exactly and reports the actual fps",
      () => {
        const samples: Sample[] = [
          0,
          0.4,
          1,
          2
        ].map( ( t ) => ( {
          t,
          points: [
            {
              x: t / 2,
              y: 0
            }
          ]
        } ) );
        const resampled = resampleUniform(
          samples,
          60
        );

        expect( resampled.frameCount ).toBe( 121 );
        expect( resampled.fps ).toBeCloseTo(
          60,
          6
        );
        expect( resampled.frames[ 0 ] ).toBeCloseTo(
          0,
          6
        );
        expect( resampled.frames[ ( resampled.frameCount - 1 ) * 2 ] ).toBeCloseTo(
          1,
          5
        );
      }
    );

    it(
      "refuses takes with fewer than two samples or no duration",
      () => {
        expect( () => resampleUniform(
          [],
          60
        ) ).toThrow( /at least 2/ );
      }
    );
  }
);

describe(
  "detectPhases",
  () => {
    it(
      "finds the longest pinch dip with hysteresis",
      () => {
        const gaps = Float32Array.from( [
          ...Array( 5 ).fill( 0.2 ),
          ...Array( 10 ).fill( 0.05 ),
          ...Array( 5 ).fill( 0.2 )
        ] );
        const phases = detectPhases( gaps );

        expect( phases ).toMatchObject( {
          close: 5,
          open: 15
        } );
        expect( phases?.drag ).toEqual( [
          5,
          15
        ] );
        expect( phases?.enter ).toEqual( [
          0,
          5
        ] );
        expect( phases?.exit ).toEqual( [
          15,
          20
        ] );
      }
    );

    it(
      "holds an engaged pinch through the hysteresis band",
      () => {
        // 0.10 sits above the close threshold but below the open one:
        // it must not release an engaged pinch.
        const gaps = Float32Array.from( [
          0.2,
          0.05,
          0.1,
          0.05,
          0.2
        ] );
        const phases = detectPhases(
          gaps,
          {
            closeThreshold: 0.07,
            openThreshold: 0.15
          }
        );

        expect( phases?.drag ).toEqual( [
          1,
          4
        ] );
      }
    );

    it(
      "returns null when the take never really pinches",
      () => {
        const flat = Float32Array.from( Array( 20 ).fill( 0.2 ) );

        expect( detectPhases( flat ) ).toBeNull();
        expect( detectPhases( new Float32Array( 0 ) ) ).toBeNull();
      }
    );
  }
);

// ── Synthetic pinch-and-drag take, tips-6 layout ────────────────────────────
// The hand hovers at x = 0.2, pinches at t = 0.5, drags to x = 0.7 by
// t = 1.5, releases and holds. Sampled at an irregular ~30 fps, like the real
// tracker.
const DRAG_START = 0.5;
const DRAG_END = 1.5;

const midAt = ( t: number ): Point => ( {
  x: 0.2 + 0.5 * Math.min(
    Math.max(
      ( t - DRAG_START ) / ( DRAG_END - DRAG_START ),
      0
    ),
    1
  ),
  y: 0.5
} );
const gapAt = ( t: number ) => ( t >= DRAG_START && t <= DRAG_END ? 0.03 : 0.16 );
const handAt = ( t: number ): Point[] => {
  const mid = midAt( t );
  const gap = gapAt( t );

  return [
    {
      x: mid.x,
      y: mid.y + 0.12
    }, // palm
    {
      x: mid.x - gap / 2,
      y: mid.y
    }, // thumb tip
    {
      x: mid.x + gap / 2,
      y: mid.y
    }, // index tip
    {
      x: mid.x + 0.06,
      y: mid.y - 0.04
    },
    {
      x: mid.x + 0.09,
      y: mid.y - 0.03
    },
    {
      x: mid.x + 0.12,
      y: mid.y - 0.02
    }
  ];
};
const syntheticTake = (): Sample[] => {
  const samples: Sample[] = [];
  let t = 0;
  let k = 0;

  while ( t <= 2 ) {
    samples.push( {
      t,
      points: handAt( t )
    } );
    t += 0.028 + 0.01 * ( ( k * 37 ) % 10 ) / 10;
    k++;
  }

  return samples;
};

describe(
  "bakeHandClip",
  () => {
    it(
      "bakes a raw take into a 60 fps clip with phases and anchors",
      () => {
        const clip = bakeHandClip(
          syntheticTake(),
          {
            name: "synthetic-drag",
            layout: "tips-6",
            aspect: 16 / 9,
            recordedAt: "2026-01-01T00:00:00.000Z"
          }
        );

        expect( clip.layout ).toBe( "tips-6" );
        expect( clip.fps ).toBeGreaterThan( 55 );
        expect( clip.fps ).toBeLessThan( 65 );
        expect( clip.frameCount ).toBeGreaterThan( 100 );
        // The synthetic hover/hold sections are perfectly still, so their
        // runs collapse to endpoints and the distinct-sample rate reads low.
        expect( clip.capture?.sourceFps ).toBeGreaterThan( 10 );
        expect( clip.capture?.sourceFps ).toBeLessThan( 40 );

        // The pinch interval lands around t = 0.5 → 1.5 on the 60 fps grid.
        expect( clip.phases?.close ).toBeGreaterThan( 20 );
        expect( clip.phases?.close ).toBeLessThan( 45 );
        expect( clip.phases?.open ).toBeGreaterThan( 80 );
        expect( clip.phases?.open ).toBeLessThan( 105 );

        // Grab where the hand pinched, release where it let go. The close
        // latch fires partway down the smoothed gap transition — and this
        // synthetic take starts dragging the very instant it pinches — so
        // the grab anchor sits slightly along the path.
        expect( clip.anchors?.grab.x ).toBeGreaterThan( 0.15 );
        expect( clip.anchors?.grab.x ).toBeLessThan( 0.33 );
        expect( clip.anchors?.release.x ).toBeCloseTo(
          0.7,
          1
        );

        // Gap range covers open hand → pinched hand.
        expect( clip.gapRange?.[ 0 ] ).toBeLessThan( 0.06 );
        expect( clip.gapRange?.[ 1 ] ).toBeGreaterThan( 0.12 );
      }
    );

    it(
      "survives the serialize/parse round trip within quantization error",
      () => {
        const clip = bakeHandClip(
          syntheticTake(),
          {
            layout: "tips-6"
          }
        );
        const parsed = parseHandClip( serializeHandClip( clip ) );

        expect( parsed.frameCount ).toBe( clip.frameCount );
        expect( parsed.phases ).toEqual( clip.phases );

        for ( let i = 0; i < clip.frames.length; i++ ) {
          expect( Math.abs( parsed.frames[ i ] - clip.frames[ i ] ) ).toBeLessThanOrEqual( 0.5 / 4096 + 1e-6 );
        }

        // And the derived series agree.
        expect( Array.from( gapSeries( parsed ) )[ clip.phases!.close ] ).toBeCloseTo(
          gapSeries( clip )[ clip.phases!.close ],
          3
        );
        expect( deriveAnchors(
          parsed,
          parsed.phases
        )?.grab.x ).toBeCloseTo(
          clip.anchors!.grab.x,
          3
        );
      }
    );

    it(
      "rejects takes that don't match the layout",
      () => {
        expect( () => bakeHandClip(
          [
            {
              t: 0,
              points: [
                {
                  x: 0,
                  y: 0
                }
              ]
            },
            {
              t: 0.1,
              points: [
                {
                  x: 1,
                  y: 1
                }
              ]
            }
          ],
          {
            layout: "tips-6"
          }
        ) ).toThrow( /expects 6/ );
        expect( () => bakeHandClip(
          [],
          {}
        ) ).toThrow( /too short/ );
      }
    );
  }
);
