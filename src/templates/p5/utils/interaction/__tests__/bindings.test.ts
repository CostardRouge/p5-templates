/**
 * Unit tests for the interactive-bindings mapping pipeline.
 *
 * These cover the PURE resolver (`bindings.js`) in isolation — channel
 * projection, curve shaping, the continuous + vector2d mapping families, the
 * dotted-path writer, and the top-level `resolveBindings` (clone, multi-binding,
 * graceful handling of missing channels / no bindings).
 */
import {
  projectChannel,
  applyCurve,
  mapContinuous,
  mapVector,
  setPath,
  resolveBindings,
  waveValue,
  oscillatorValue,
  rampValue,
  sequenceValue,
  noiseValue,
  randomValue,
  shapedScalar,
  computeBindingSignals,
  isGenerator
} from "../bindings.js";

const vec = (
  x: number, y: number
) => ( {
  type: "vector2d" as const,
  x,
  y
} );
const scalar = ( value: number ) => ( {
  type: "scalar" as const,
  value
} );

describe(
  "projectChannel",
  () => {
    it(
      "passes a scalar channel through, clamped to 0..1",
      () => {
        expect( projectChannel(
          scalar( 0.4 ),
          undefined
        ) ).toBeCloseTo( 0.4 );
        expect( projectChannel(
          scalar( 2 ),
          undefined
        ) ).toBe( 1 );
        expect( projectChannel(
          scalar( -1 ),
          undefined
        ) ).toBe( 0 );
      }
    );

    it(
      "projects vector x / y",
      () => {
        expect( projectChannel(
          vec(
            0.3,
            0.8
          ),
          "x"
        ) ).toBeCloseTo( 0.3 );
        expect( projectChannel(
          vec(
            0.3,
            0.8
          ),
          "y"
        ) ).toBeCloseTo( 0.8 );
      }
    );

    it(
      "defaults to x projection when none is given",
      () => {
        expect( projectChannel(
          vec(
            0.25,
            0.9
          ),
          undefined
        ) ).toBeCloseTo( 0.25 );
      }
    );

    it(
      "projects magnitude from the center, normalized to 0..1",
      () => {
        // Center → 0
        expect( projectChannel(
          vec(
            0.5,
            0.5
          ),
          "mag"
        ) ).toBeCloseTo( 0 );
        // Corner → 1 (max distance √0.5)
        expect( projectChannel(
          vec(
            1,
            1
          ),
          "mag"
        ) ).toBeCloseTo( 1 );
      }
    );

    it(
      "projects angle into 0..1",
      () => {
        // Pointing left of center → atan2(0, -0.5) = π → (π+π)/2π = 1
        expect( projectChannel(
          vec(
            0,
            0.5
          ),
          "angle"
        ) ).toBeCloseTo( 1 );
        // Pointing right of center → atan2(0, +0.5) = 0 → 0.5
        expect( projectChannel(
          vec(
            1,
            0.5
          ),
          "angle"
        ) ).toBeCloseTo( 0.5 );
      }
    );

    it(
      "returns 0 for a missing channel",
      () => {
        expect( projectChannel(
          undefined,
          "x"
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "applyCurve",
  () => {
    it(
      "linear is identity",
      () => {
        expect( applyCurve(
          0.3,
          "linear"
        ) ).toBeCloseTo( 0.3 );
        expect( applyCurve(
          0.3,
          undefined
        ) ).toBeCloseTo( 0.3 );
      }
    );

    it(
      "applies easing keys from the shared easing set",
      () => {
        // easeInQuad(0.5) = 0.25, easeOutQuad(0.5) = 0.75
        expect( applyCurve(
          0.5,
          "easeInQuad"
        ) ).toBeCloseTo( 0.25 );
        expect( applyCurve(
          0.5,
          "easeOutQuad"
        ) ).toBeCloseTo( 0.75 );
        // smoothstep(x) = x²(3 - 2x)
        expect( applyCurve(
          0.5,
          "smoothstep"
        ) ).toBeCloseTo( 0.5 );
        expect( applyCurve(
          0,
          "smoothstep"
        ) ).toBeCloseTo( 0 );
        expect( applyCurve(
          1,
          "smoothstep"
        ) ).toBeCloseTo( 1 );
      }
    );

    it(
      "falls through to identity for an unknown easing key",
      () => {
        expect( applyCurve(
          0.42,
          "not-an-easing"
        ) ).toBeCloseTo( 0.42 );
      }
    );
  }
);

describe(
  "mapContinuous",
  () => {
    it(
      "maps a projected 0..1 signal onto [min, max]",
      () => {
        const value = mapContinuous(
          vec(
            0.5,
            0
          ),
          {
            source: "mouse",
            project: "x",
            target: "radius",
            mapping: {
              min: 40,
              max: 360
            }
          } as any
        );

        expect( value ).toBeCloseTo( 200 ); // 0.5 across [40, 360]
      }
    );

    it(
      "honors invert",
      () => {
        const value = mapContinuous(
          vec(
            0,
            0.25
          ),
          {
            source: "mouse",
            project: "y",
            target: "w",
            mapping: {
              min: 0,
              max: 100,
              invert: true
            }
          } as any
        );

        expect( value ).toBeCloseTo( 75 ); // (1 - 0.25) * 100
      }
    );

    it(
      "defaults to a 0..1 range when mapping is omitted",
      () => {
        expect( mapContinuous(
          scalar( 0.6 ),
          {
            source: "osc",
            target: "x"
          } as any
        ) ).toBeCloseTo( 0.6 );
      }
    );
  }
);

describe(
  "mapVector",
  () => {
    it(
      "passes a vector2d channel through each axis range",
      () => {
        const value = mapVector(
          vec(
            0.25,
            0.75
          ),
          {
            source: "mouse",
            target: "pos",
            kind: "vector2d",
            mapping: {
              x: {
                min: 0,
                max: 200
              },
              y: {
                min: 0,
                max: 400
              }
            }
          } as any
        );

        expect( value.x ).toBeCloseTo( 50 );
        expect( value.y ).toBeCloseTo( 300 );
      }
    );

    it(
      "defaults to a 0..1 identity passthrough",
      () => {
        const value = mapVector(
          vec(
            0.4,
            0.6
          ),
          {
            source: "mouse",
            target: "pos",
            kind: "vector2d"
          } as any
        );

        expect( value.x ).toBeCloseTo( 0.4 );
        expect( value.y ).toBeCloseTo( 0.6 );
      }
    );
  }
);

describe(
  "setPath",
  () => {
    it(
      "writes a top-level key",
      () => {
        const obj: any = {};

        setPath(
          obj,
          "radius",
          12
        );
        expect( obj.radius ).toBe( 12 );
      }
    );

    it(
      "writes a nested key, creating intermediates",
      () => {
        const obj: any = {};

        setPath(
          obj,
          "ring.inner.radius",
          5
        );
        expect( obj.ring.inner.radius ).toBe( 5 );
      }
    );
  }
);

describe(
  "resolveBindings",
  () => {
    const channels = {
      mouse: vec(
        0.25,
        0.75
      ),
      osc: scalar( 1 )
    };

    it(
      "returns the base object untouched when there are no bindings",
      () => {
        const base = {
          radius: 100
        };

        expect( resolveBindings(
          base,
          channels,
          0
        ) ).toBe( base );
      }
    );

    it(
      "produces a modulated clone without mutating the base",
      () => {
        const base = {
          radius: 100,
          strokeWeight: 1,
          position: {
            x: 0.5,
            y: 0.5
          },
          bindings: [
            {
              source: "mouse",
              project: "x",
              target: "radius",
              kind: "continuous",
              mapping: {
                min: 0,
                max: 400
              }
            },
            {
              source: "osc",
              target: "strokeWeight",
              kind: "continuous",
              mapping: {
                min: 0,
                max: 10
              }
            },
            {
              source: "mouse",
              target: "position",
              kind: "vector2d"
            }
          ]
        };

        const out: any = resolveBindings(
          base,
          channels,
          1
        );

        // Modulated values
        expect( out.radius ).toBeCloseTo( 100 ); // 0.25 across [0, 400]
        expect( out.strokeWeight ).toBeCloseTo( 10 ); // osc = 1 across [0, 10]
        expect( out.position.x ).toBeCloseTo( 0.25 );
        expect( out.position.y ).toBeCloseTo( 0.75 );

        // Base is never mutated
        expect( base.radius ).toBe( 100 );
        expect( base.strokeWeight ).toBe( 1 );
        expect( base.position ).toEqual( {
          x: 0.5,
          y: 0.5
        } );
      }
    );

    it(
      "skips a binding whose channel is missing, keeping the base value",
      () => {
        const base = {
          radius: 42,
          bindings: [
            {
              source: "gyro",
              target: "radius",
              kind: "continuous",
              mapping: {
                min: 0,
                max: 1
              }
            }
          ]
        };

        const out: any = resolveBindings(
          base,
          channels,
          2
        );

        expect( out.radius ).toBe( 42 );
      }
    );

    it(
      "ignores disabled bindings",
      () => {
        const base = {
          radius: 7,
          bindings: [
            {
              source: "mouse",
              project: "x",
              target: "radius",
              kind: "continuous",
              enabled: false,
              mapping: {
                min: 0,
                max: 400
              }
            }
          ]
        };

        const out: any = resolveBindings(
          base,
          channels,
          3
        );

        expect( out.radius ).toBe( 7 );
      }
    );
  }
);

describe(
  "generators",
  () => {
    it(
      "flags oscillator / ramp as generators, inputs as not",
      () => {
        expect( isGenerator( "oscillator" ) ).toBe( true );
        expect( isGenerator( "ramp" ) ).toBe( true );
        expect( isGenerator( "mouse" ) ).toBe( false );
      }
    );

    it(
      "waveValue shapes one cycle per wave type",
      () => {
        // sine sweeps 0→1→0
        expect( waveValue(
          "sine",
          0
        ) ).toBeCloseTo( 0 );
        expect( waveValue(
          "sine",
          0.5
        ) ).toBeCloseTo( 1 );
        expect( waveValue(
          "sine",
          1
        ) ).toBeCloseTo( 0 );

        // triangle 0→1→0
        expect( waveValue(
          "triangle",
          0
        ) ).toBeCloseTo( 0 );
        expect( waveValue(
          "triangle",
          0.5
        ) ).toBeCloseTo( 1 );

        // square: low then high
        expect( waveValue(
          "square",
          0.25
        ) ).toBe( 0 );
        expect( waveValue(
          "square",
          0.75
        ) ).toBe( 1 );

        // sawtooth ramps with phase
        expect( waveValue(
          "sawtooth",
          0.3
        ) ).toBeCloseTo( 0.3 );
      }
    );

    it(
      "oscillatorValue applies cycles and phase against progression",
      () => {
        // sine, 1 cycle, progression 0.5 → peak
        expect( oscillatorValue(
          {
            wave: "sine",
            cycles: 1
          },
          {
            progression: 0.5
          }
        ) ).toBeCloseTo( 1 );

        // 2 cycles: progression 0.25 lands on the first peak
        expect( oscillatorValue(
          {
            wave: "sine",
            cycles: 2
          },
          {
            progression: 0.25
          }
        ) ).toBeCloseTo( 1 );

        // phase shifts the waveform
        expect( oscillatorValue(
          {
            wave: "sawtooth",
            cycles: 1,
            phase: 0.25
          },
          {
            progression: 0
          }
        ) ).toBeCloseTo( 0.25 );
      }
    );

    it(
      "rampValue eases a repeating sweep, optionally yoyo",
      () => {
        // linear ramp, count 1 → equals progression
        expect( rampValue(
          {
            easing: "linear",
            count: 1
          },
          {
            progression: 0.4
          }
        ) ).toBeCloseTo( 0.4 );

        // count 2 wraps
        expect( rampValue(
          {
            easing: "linear",
            count: 2
          },
          {
            progression: 0.75
          }
        ) ).toBeCloseTo( 0.5 );

        // yoyo folds 0→1→0: progression 0.5 → peak
        expect( rampValue(
          {
            easing: "linear",
            count: 1,
            yoyo: true
          },
          {
            progression: 0.5
          }
        ) ).toBeCloseTo( 1 );
      }
    );

    it(
      "resolves an oscillator binding from progression (no channel needed)",
      () => {
        const base = {
          radius: 0,
          bindings: [
            {
              source: "oscillator",
              target: "radius",
              kind: "continuous",
              oscillator: {
                wave: "sine",
                cycles: 1
              },
              mapping: {
                min: 0,
                max: 200
              }
            }
          ]
        };

        const out: any = resolveBindings(
          base,
          {},
          10,
          {
            progression: 0.5
          }
        );

        expect( out.radius ).toBeCloseTo( 200 ); // sine peak across [0, 200]
      }
    );

    it(
      "shapedScalar applies invert + curve on top of the generator",
      () => {
        const s = shapedScalar(
          {
            source: "oscillator",
            oscillator: {
              wave: "sawtooth",
              cycles: 1
            },
            mapping: {
              invert: true
            }
          },
          undefined,
          {
            progression: 0.25
          }
        );

        expect( s ).toBeCloseTo( 0.75 ); // 1 - 0.25
      }
    );

    it(
      "computeBindingSignals reports each binding's normalized signal by target",
      () => {
        const base = {
          bindings: [
            {
              source: "oscillator",
              target: "radius",
              kind: "continuous",
              oscillator: {
                wave: "sine",
                cycles: 1
              }
            },
            {
              source: "mouse",
              project: "x",
              target: "weight",
              kind: "continuous"
            }
          ]
        };

        const signals: any = computeBindingSignals(
          base,
          {
            mouse: vec(
              0.3,
              0.6
            )
          },
          {
            progression: 0.5
          }
        );

        expect( signals.radius ).toBeCloseTo( 1 ); // sine peak
        expect( signals.weight ).toBeCloseTo( 0.3 ); // mouse.x
      }
    );
  }
);

describe(
  "sequence generator",
  () => {
    it(
      "is registered as a generator",
      () => {
        expect( isGenerator( "sequence" ) ).toBe( true );
      }
    );

    it(
      "steps through stops, normalized against [min, max]",
      () => {
        const seq = {
          stops: [
            0,
            50,
            100
          ],
          cycles: 1,
          mode: "step"
        };

        // progression 0 → first stop (0) → normalized 0
        expect( sequenceValue(
          seq,
          {
            progression: 0
          },
          0,
          100
        ) ).toBeCloseTo( 0 );

        // progression 0.5 → middle stop (50) → normalized 0.5
        expect( sequenceValue(
          seq,
          {
            progression: 0.5
          },
          0,
          100
        ) ).toBeCloseTo( 0.5 );

        // just past 2/3 → last stop (100) → normalized 1
        expect( sequenceValue(
          seq,
          {
            progression: 0.7
          },
          0,
          100
        ) ).toBeCloseTo( 1 );
      }
    );

    it(
      "interpolates between stops in smooth mode",
      () => {
        const value = sequenceValue(
          {
            stops: [
              0,
              100
            ],
            cycles: 1,
            mode: "smooth"
          },
          {
            progression: 0.25
          },
          0,
          100
        );

        // pos 0.5 between stop 0 (0) and stop 1 (100) → 50 → normalized 0.5
        expect( value ).toBeCloseTo( 0.5 );
      }
    );

    it(
      "eases each transition when smooth mode has an easing",
      () => {
        // easeInQuad at the segment midpoint (0.5) → 0.25
        const value = sequenceValue(
          {
            stops: [
              0,
              100
            ],
            cycles: 1,
            mode: "smooth",
            easing: "easeInQuad"
          },
          {
            progression: 0.25
          },
          0,
          100
        );

        expect( value ).toBeCloseTo( 0.25 ); // lerp(0,100, easeInQuad(0.5)) / 100
      }
    );

    it(
      "dwells on a stop for `hold` before transitioning",
      () => {
        const seq = {
          stops: [
            0,
            100
          ],
          cycles: 1,
          mode: "smooth",
          hold: 0.5
        };

        // Within the hold window (segment fraction 0.25 ≤ 0.5) → still stop 0
        expect( sequenceValue(
          seq,
          {
            progression: 0.125
          },
          0,
          100
        ) ).toBeCloseTo( 0 );

        // Past the hold: fraction 0.75 → remapped (0.75-0.5)/0.5 = 0.5 → 50
        expect( sequenceValue(
          seq,
          {
            progression: 0.375
          },
          0,
          100
        ) ).toBeCloseTo( 0.5 );
      }
    );

    it(
      "returns 0 with no stops",
      () => {
        expect( sequenceValue(
          {
            stops: []
          },
          {
            progression: 0.5
          },
          0,
          100
        ) ).toBe( 0 );
      }
    );

    it(
      "noise is deterministic, in 0..1, and smooth",
      () => {
        const a = noiseValue(
          {
            speed: 2,
            seed: 5
          },
          {
            progression: 0.3
          }
        );
        const aAgain = noiseValue(
          {
            speed: 2,
            seed: 5
          },
          {
            progression: 0.3
          }
        );

        expect( a ).toBe( aAgain ); // deterministic
        expect( a ).toBeGreaterThanOrEqual( 0 );
        expect( a ).toBeLessThanOrEqual( 1 );

        // A tiny progression step moves the value only a little (smooth).
        const b = noiseValue(
          {
            speed: 2,
            seed: 5
          },
          {
            progression: 0.301
          }
        );

        expect( Math.abs( b - a ) ).toBeLessThan( 0.1 );
      }
    );

    it(
      "random holds within a step and is deterministic",
      () => {
        const rnd = {
          steps: 4,
          seed: 1
        };

        // progression 0.1 and 0.2 are both in slot 0 → identical (held)
        expect( randomValue(
          rnd,
          {
            progression: 0.1
          }
        ) ).toBe( randomValue(
          rnd,
          {
            progression: 0.2
          }
        ) );

        // a value in 0..1
        const v = randomValue(
          rnd,
          {
            progression: 0.1
          }
        );

        expect( v ).toBeGreaterThanOrEqual( 0 );
        expect( v ).toBeLessThanOrEqual( 1 );

        // different seed → (almost surely) different value in the same slot
        expect( randomValue(
          {
            steps: 4,
            seed: 2
          },
          {
            progression: 0.1
          }
        ) ).not.toBe( v );
      }
    );

    it(
      "noise / random are registered as generators",
      () => {
        expect( isGenerator( "noise" ) ).toBe( true );
        expect( isGenerator( "random" ) ).toBe( true );
      }
    );

    it(
      "resolves a sequence binding back to the stop value (min/max = domain)",
      () => {
        const base = {
          radius: 0,
          bindings: [
            {
              source: "sequence",
              target: "radius",
              kind: "continuous",
              sequence: {
                stops: [
                  10,
                  90
                ],
                cycles: 1,
                mode: "step"
              },
              mapping: {
                min: 10,
                max: 90
              }
            }
          ]
        };

        // progression 0 → stop 10; the round-trip through min/max yields 10.
        expect( ( resolveBindings(
          base,
          {},
          1,
          {
            progression: 0
          }
        ) as any ).radius ).toBeCloseTo( 10 );

        // progression 0.5 → stop 90 → yields 90.
        expect( ( resolveBindings(
          base,
          {},
          2,
          {
            progression: 0.5
          }
        ) as any ).radius ).toBeCloseTo( 90 );
      }
    );
  }
);
