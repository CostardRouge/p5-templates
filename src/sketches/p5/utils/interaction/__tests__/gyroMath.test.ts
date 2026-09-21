/**
 * Unit tests for the pure gyroscope state machine (`gyroMath.js`) behind the
 * `gyroscope` interaction source: the four modes, calibration, screen
 * rotation, inversion, smoothing, the frame guard and the absence rule.
 */
import {
  GYRO_MODE_DEFAULTS,
  angleDelta,
  envelope,
  freshGyroState,
  gravityFromOrientation,
  normalizeGyroOptions,
  recalibrate,
  rotateForScreen,
  stepGyroscope,
  toCanvas
} from "../gyroMath.js";

type Vec = {
  x: number;
  y: number;
};

const orientation = (
  beta: number,
  gamma: number
) => ( {
  orientation: {
    beta,
    gamma
  },
  acceleration: null,
  rotationRate: null,
  screenAngle: 0
} );

const options = ( overrides: Record<string, unknown> = {} ) => normalizeGyroOptions( {
  source: {
    mode: "tilt",
    range: 30
  },
  calibration: "auto",
  smoothing: 0,
  ...overrides
} );

const near = (
  v: Vec | null,
  x: number,
  y: number
) => {
  expect( v ).not.toBeNull();
  expect( ( v as Vec ).x ).toBeCloseTo(
    x,
    5
  );
  expect( ( v as Vec ).y ).toBeCloseTo(
    y,
    5
  );
};

describe(
  "normalizeGyroOptions",
  () => {
    it(
      "fills every field from the mode defaults",
      () => {
        const normalized = normalizeGyroOptions( {} );

        expect( normalized.mode ).toBe( "tilt" );
        expect( normalized.range ).toBe( GYRO_MODE_DEFAULTS.tilt.range );
        expect( normalized.calibration ).toBe( "auto" );
        expect( normalized.invert ).toEqual( {
          x: false,
          y: false
        } );
        expect( normalized.screenRotation ).toBe( true );
        expect( normalized.smoothing ).toBe( 0 );
      }
    );

    it(
      "honours the pre-mode clampAngle as the tilt range, and only for tilt",
      () => {
        expect( normalizeGyroOptions( {
          clampAngle: 45
        } ).range ).toBe( 45 );
        expect( normalizeGyroOptions( {
          clampAngle: 45,
          source: {
            mode: "gravity"
          }
        } ).range ).toBe( GYRO_MODE_DEFAULTS.gravity.range );
      }
    );

    it(
      "rejects an unknown mode or calibration and a non-positive range",
      () => {
        const normalized = normalizeGyroOptions( {
          source: {
            mode: "warp",
            range: -3
          },
          calibration: "sideways"
        } );

        expect( normalized.mode ).toBe( "tilt" );
        expect( normalized.range ).toBe( GYRO_MODE_DEFAULTS.tilt.range );
        expect( normalized.calibration ).toBe( "auto" );
      }
    );

    it(
      "reads the neutral pad as x = roll (gamma), y = pitch (beta)",
      () => {
        expect( normalizeGyroOptions( {
          neutral: {
            x: 5,
            y: 40
          }
        } ).neutral ).toEqual( {
          beta: 40,
          gamma: 5
        } );
      }
    );
  }
);

describe(
  "angleDelta / envelope / rotateForScreen / gravityFromOrientation",
  () => {
    it(
      "takes the short way round the wrap",
      () => {
        expect( angleDelta(
          -175,
          170
        ) ).toBe( 15 );
        expect( angleDelta(
          170,
          -175
        ) ).toBe( -15 );
        expect( angleDelta(
          30,
          10
        ) ).toBe( 20 );
      }
    );

    it(
      "attacks instantly and releases geometrically",
      () => {
        expect( envelope(
          0,
          6,
          0.5
        ) ).toBe( 6 );
        expect( envelope(
          6,
          1,
          0.5
        ) ).toBe( 3 );
        expect( envelope(
          -6,
          2,
          0.5
        ) ).toBe( -3 );
      }
    );

    it(
      "re-expresses the device vector for each screen angle",
      () => {
        const v = {
          x: 1,
          y: 0.5
        };

        expect( rotateForScreen(
          v,
          0
        ) ).toEqual( v );
        expect( rotateForScreen(
          v,
          90
        ) ).toEqual( {
          x: 0.5,
          y: -1
        } );
        expect( rotateForScreen(
          v,
          180
        ) ).toEqual( {
          x: -1,
          y: -0.5
        } );
        expect( rotateForScreen(
          v,
          270
        ) ).toEqual( {
          x: -0.5,
          y: 1
        } );
        // Legacy window.orientation reports -90 for the 270 case.
        expect( rotateForScreen(
          v,
          -90
        ) ).toEqual( rotateForScreen(
          v,
          270
        ) );
      }
    );

    it(
      "projects gravity on the screen: flat → 0, upright → down, and x fades near vertical",
      () => {
        near(
          gravityFromOrientation(
            0,
            0
          ),
          0,
          0
        );
        near(
          gravityFromOrientation(
            90,
            0
          ),
          0,
          1
        );
        near(
          gravityFromOrientation(
            0,
            90
          ),
          1,
          0
        );
        near(
          gravityFromOrientation(
            90,
            45
          ),
          0,
          1
        );
      }
    );
  }
);

describe(
  "stepGyroscope · tilt",
  () => {
    it(
      "publishes nothing until an orientation reading exists",
      () => {
        const state = freshGyroState();

        expect( stepGyroscope(
          state,
          {
            orientation: null,
            acceleration: null,
            rotationRate: null,
            screenAngle: 0
          },
          options(),
          1
        ) ).toBeNull();
      }
    );

    it(
      "auto-calibrates on the first reading, then maps `range` degrees to the edge",
      () => {
        const state = freshGyroState();
        const opts = options();

        near(
          stepGyroscope(
            state,
            orientation(
              60,
              -5
            ),
            opts,
            1
          ),
          0,
          0
        );
        near(
          stepGyroscope(
            state,
            orientation(
              90,
              10
            ),
            opts,
            2
          ),
          0.5,
          1
        );
        // Beyond the range clamps, it does not wrap.
        near(
          stepGyroscope(
            state,
            orientation(
              150,
              -50
            ),
            opts,
            3
          ),
          -1,
          1
        );
      }
    );

    it(
      "uses (0, 0) as the centre with `flat`, and the pad with `custom`",
      () => {
        near(
          stepGyroscope(
            freshGyroState(),
            orientation(
              15,
              -15
            ),
            options( {
              calibration: "flat"
            } ),
            1
          ),
          -0.5,
          0.5
        );
        near(
          stepGyroscope(
            freshGyroState(),
            orientation(
              55,
              0
            ),
            options( {
              calibration: "custom",
              neutral: {
                x: 0,
                y: 40
              }
            } ),
            1
          ),
          0,
          0.5
        );
      }
    );

    it(
      "recalibrates on demand and when the mode or calibration changes",
      () => {
        const state = freshGyroState();

        stepGyroscope(
          state,
          orientation(
            60,
            0
          ),
          options(),
          1
        );
        recalibrate( state );
        near(
          stepGyroscope(
            state,
            orientation(
              20,
              20
            ),
            options(),
            2
          ),
          0,
          0
        );

        near(
          stepGyroscope(
            state,
            orientation(
              35,
              35
            ),
            options( {
              source: {
                mode: "gravity",
                range: 0.5
              }
            } ),
            3
          ),
          0,
          0
        );
      }
    );

    it(
      "applies the screen rotation, then the inversion",
      () => {
        const state = freshGyroState();
        const opts = options( {
          calibration: "flat",
          invert: {
            x: true,
            y: false
          }
        } );

        // Device: right edge dips 15° (gamma) → x = 0.5 in the device frame.
        // Landscape with the top pointing left (90°) turns that into y = -0.5;
        // x becomes the (zero) beta term, then flips to -0.
        const v = stepGyroscope(
          state,
          {
            ...orientation(
              0,
              15
            ),
            screenAngle: 90
          },
          opts,
          1
        ) as Vec;

        expect( v.x ).toBeCloseTo(
          0,
          5
        );
        expect( v.y ).toBeCloseTo(
          -0.5,
          5
        );

        near(
          stepGyroscope(
            state,
            {
              ...orientation(
                0,
                15
              ),
              screenAngle: 90
            },
            {
              ...opts,
              screenRotation: false
            },
            2
          ),
          -0.5,
          0
        );
      }
    );

    it(
      "smooths toward the target and answers the same frame with the same value",
      () => {
        const state = freshGyroState();
        const opts = options( {
          calibration: "flat",
          smoothing: 0.5
        } );

        near(
          stepGyroscope(
            state,
            orientation(
              30,
              0
            ),
            opts,
            1
          ),
          0,
          1
        );
        near(
          stepGyroscope(
            state,
            orientation(
              0,
              0
            ),
            opts,
            2
          ),
          0,
          0.5
        );
        // Same frame again: no further decay.
        near(
          stepGyroscope(
            state,
            orientation(
              0,
              0
            ),
            opts,
            2
          ),
          0,
          0.5
        );
        near(
          stepGyroscope(
            state,
            orientation(
              0,
              0
            ),
            opts,
            3
          ),
          0,
          0.25
        );
      }
    );
  }
);

describe(
  "stepGyroscope · gravity",
  () => {
    it(
      "follows the projected gravity from the calibrated pose",
      () => {
        const state = freshGyroState();
        const opts = options( {
          source: {
            mode: "gravity",
            range: 0.5
          },
          calibration: "flat"
        } );

        near(
          stepGyroscope(
            state,
            orientation(
              30,
              0
            ),
            opts,
            1
          ),
          0,
          1
        );
        near(
          stepGyroscope(
            state,
            orientation(
              0,
              -30
            ),
            opts,
            2
          ),
          -1,
          0
        );
      }
    );

    it(
      "keeps x continuous through the vertical, where raw gamma would flip",
      () => {
        const state = freshGyroState();
        const opts = options( {
          source: {
            mode: "gravity",
            range: 1
          },
          calibration: "flat"
        } );

        const before = stepGyroscope(
          state,
          orientation(
            89,
            30
          ),
          opts,
          1
        ) as Vec;
        const after = stepGyroscope(
          state,
          orientation(
            91,
            -30
          ),
          opts,
          2
        ) as Vec;

        expect( Math.abs( before.x - after.x ) ).toBeLessThan( 0.05 );
      }
    );
  }
);

describe(
  "stepGyroscope · acceleration",
  () => {
    const opts = options( {
      source: {
        mode: "acceleration",
        range: 8,
        release: 0.5
      }
    } );

    it(
      "publishes nothing without a motion reading, even with orientation",
      () => {
        expect( stepGyroscope(
          freshGyroState(),
          orientation(
            40,
            0
          ),
          opts,
          1
        ) ).toBeNull();
      }
    );

    it(
      "punches out on a spike (device y up → canvas y down) and releases toward the centre",
      () => {
        const state = freshGyroState();
        const reading = (
          x: number, y: number
        ) => ( {
          orientation: null,
          acceleration: {
            x,
            y
          },
          rotationRate: null,
          screenAngle: 0
        } );

        near(
          stepGyroscope(
            state,
            reading(
              4,
              8
            ),
            opts,
            1
          ),
          0.5,
          -1
        );
        near(
          stepGyroscope(
            state,
            reading(
              0,
              0
            ),
            opts,
            2
          ),
          0.25,
          -0.5
        );
        near(
          stepGyroscope(
            state,
            reading(
              0,
              0
            ),
            opts,
            3
          ),
          0.125,
          -0.25
        );
      }
    );
  }
);

describe(
  "stepGyroscope · rotation",
  () => {
    const opts = options( {
      source: {
        mode: "rotation",
        range: 180,
        deadzone: 3
      }
    } );
    const reading = (
      beta: number, gamma: number
    ) => ( {
      orientation: null,
      acceleration: null,
      rotationRate: {
        beta,
        gamma
      },
      screenAngle: 0
    } );

    it(
      "integrates the rate over time, ignores the dead zone and stays put",
      () => {
        const state = freshGyroState();

        near(
          stepGyroscope(
            state,
            reading(
              90,
              -45
            ),
            opts,
            1,
            0.5
          ),
          -0.125,
          0.25
        );
        near(
          stepGyroscope(
            state,
            reading(
              2,
              -2
            ),
            opts,
            2,
            10
          ),
          -0.125,
          0.25
        );
        // Full travel saturates at the edge.
        near(
          stepGyroscope(
            state,
            reading(
              900,
              900
            ),
            opts,
            3,
            1
          ),
          1,
          1
        );
      }
    );

    it(
      "does not advance twice in one frame",
      () => {
        const state = freshGyroState();

        stepGyroscope(
          state,
          reading(
            90,
            0
          ),
          opts,
          7,
          0.5
        );
        near(
          stepGyroscope(
            state,
            reading(
              90,
              0
            ),
            opts,
            7,
            0.5
          ),
          0,
          0.25
        );
      }
    );
  }
);

describe(
  "toCanvas",
  () => {
    it(
      "puts (0,0) at the centre, (±1,±1) on the edges, clamps, then offsets",
      () => {
        expect( toCanvas(
          {
            x: 0,
            y: 0
          },
          1080,
          1350
        ) ).toEqual( {
          x: 540,
          y: 675
        } );
        expect( toCanvas(
          {
            x: 1,
            y: -1
          },
          1080,
          1350
        ) ).toEqual( {
          x: 1080,
          y: 0
        } );
        expect( toCanvas(
          {
            x: 3,
            y: 0
          },
          1080,
          1350,
          {
            x: 20,
            y: -10
          }
        ) ).toEqual( {
          x: 1100,
          y: 665
        } );
      }
    );
  }
);
