/**
 * Pure device-motion math behind the `gyroscope` interaction source — the
 * sensor counterpart of pinchMath.js / dragMath.js.
 *
 * Turns what the browser's orientation and motion events report into ONE
 * pointer on the canvas, in one of four modes:
 *
 *   tilt          the orientation angles themselves: `range` degrees of tilt
 *                 away from the neutral pose reaches the canvas edge;
 *   gravity       the gravity vector projected on the screen plane — a marble
 *                 on a tray — derived from the same angles. Proportional to
 *                 the SINE of the tilt, and well-behaved through the vertical,
 *                 where the raw roll angle (gamma) flips sign;
 *   acceleration  the linear acceleration (gravity removed): a shake or a
 *                 flick punches the pointer out and `release` lets it settle
 *                 back to the centre;
 *   rotation      the rotation rate integrated over time: the pointer moves
 *                 while the phone turns and stays where it is left, like a
 *                 joystick with no spring.
 *
 * Every mode produces a unit vector (-1..1 on each axis, canvas orientation —
 * x to the right, y downward) that then goes through the same tail: screen
 * rotation compensation (landscape), per-axis inversion, clamping, smoothing
 * and the map onto the canvas. The state is explicit (`freshGyroState`) and
 * mutated in place by `stepGyroscope`, like the pinch state machine, so the
 * listener side in index.js only stores the latest readings.
 *
 * Axis conventions (W3C DeviceOrientation, portrait, screen facing you):
 *   beta   rotation about the device X axis, -180..180. Positive when the top
 *          edge rises toward you (flat on a table → 0, upright → 90).
 *   gamma  rotation about the device Y axis, -90..90. Positive when the right
 *          edge dips.
 * So gamma drives x (right edge down → pointer right) and beta drives y (top
 * edge up → pointer DOWN: the marble rolls toward the low edge). That is the
 * "natural" mapping; `invert.y` gives the "aim" mapping where raising the
 * top edge moves the pointer up.
 *
 * Deliberately free of p5 / DOM imports so it stays cheap to unit-test.
 */

export const GYRO_MODES = [
  "tilt",
  "gravity",
  "acceleration",
  "rotation"
];

export const GYRO_CALIBRATIONS = [
  "auto",
  "flat",
  "custom"
];

// Per-mode defaults for the fields of the `source` conditional group. The
// form's own `default`s (defaults.js) mirror these; keep both in sync.
export const GYRO_MODE_DEFAULTS = {
  tilt: {
    range: 30
  },
  gravity: {
    range: 0.5
  },
  acceleration: {
    range: 8,
    release: 0.9
  },
  rotation: {
    range: 180,
    deadzone: 3
  }
};

const DEG = Math.PI / 180;

function clamp(
  value, min, max
) {
  if ( value < min ) {
    return min;
  }

  if ( value > max ) {
    return max;
  }

  return value;
}

function positive( value ) {
  return typeof value === "number" && Number.isFinite( value ) && value > 0
    ? value
    : undefined;
}

/**
 * Shortest signed difference between two angles in degrees, so a neutral
 * pose near ±180 does not produce a 360° jump when beta wraps.
 */
export function angleDelta(
  angle, reference
) {
  let delta = ( angle - reference ) % 360;

  if ( delta > 180 ) {
    delta -= 360;
  } else if ( delta < -180 ) {
    delta += 360;
  }

  return delta;
}

export function clampUnit( value ) {
  return clamp(
    value,
    -1,
    1
  );
}

/**
 * The `gyroscope` options block, normalized: every field present, the mode
 * validated, and the pre-mode `clampAngle` (the tilt that reached the edge)
 * honoured as the tilt range for documents saved before the modes existed.
 *
 * `neutral` is the form's vector2d pad: x = roll (gamma), y = pitch (beta).
 *
 * @param {object} [gyro]
 */
export function normalizeGyroOptions( gyro = {} ) {
  const source = gyro.source ?? {};
  const mode = GYRO_MODES.includes( source.mode ) ? source.mode : "tilt";
  const modeDefaults = GYRO_MODE_DEFAULTS[ mode ];
  const legacyRange = mode === "tilt" ? positive( gyro.clampAngle ) : undefined;

  return {
    mode,
    range: positive( source.range ) ?? legacyRange ?? modeDefaults.range,
    release: clamp(
      source.release ?? modeDefaults.release ?? 0,
      0,
      0.999
    ),
    deadzone: Math.max(
      0,
      source.deadzone ?? modeDefaults.deadzone ?? 0
    ),
    calibration: GYRO_CALIBRATIONS.includes( gyro.calibration ) ? gyro.calibration : "auto",
    neutral: {
      beta: gyro.neutral?.y ?? 0,
      gamma: gyro.neutral?.x ?? 0
    },
    invert: {
      x: gyro.invert?.x === true,
      y: gyro.invert?.y === true
    },
    smoothing: clamp(
      gyro.smoothing ?? 0,
      0,
      0.99
    ),
    screenRotation: gyro.screenRotation !== false,
    offset: {
      x: gyro.offset?.x ?? 0,
      y: gyro.offset?.y ?? 0
    }
  };
}

/**
 * Gravity projected on the screen plane, in units of g and canvas
 * orientation (x right, y down), from the orientation angles.
 *
 * Derived rather than read from `accelerationIncludingGravity` on purpose:
 * that field's sign is inverted on iOS relative to Android, while the angles
 * agree everywhere. Flat → (0, 0); right edge down 90° → (1, 0); upright →
 * (0, 1), and x fades to 0 as the phone nears vertical (cos beta), which is
 * exactly where gamma alone becomes ambiguous.
 *
 * @param {number} beta - degrees
 * @param {number} gamma - degrees
 * @returns {{ x: number, y: number }}
 */
export function gravityFromOrientation(
  beta, gamma
) {
  const b = beta * DEG;
  const g = gamma * DEG;

  return {
    x: Math.sin( g ) * Math.cos( b ),
    y: Math.sin( b )
  };
}

/**
 * Re-express a device-frame unit vector in the viewport's frame when the
 * screen is rotated. `angle` is `screen.orientation.angle` (or the legacy
 * `window.orientation`): 90 is the device turned so its top edge points
 * left, 270 (or -90) so it points right.
 *
 * @param {{ x: number, y: number }} v
 * @param {number} angle - degrees, any multiple of 90 (negative accepted)
 * @returns {{ x: number, y: number }}
 */
export function rotateForScreen(
  v, angle
) {
  const quarter = ( ( Math.round( ( angle ?? 0 ) / 90 ) % 4 ) + 4 ) % 4;

  switch ( quarter ) {
    case 1:
      return {
        x: v.y,
        y: -v.x
      };
    case 2:
      return {
        x: -v.x,
        y: -v.y
      };
    case 3:
      return {
        x: -v.y,
        y: v.x
      };
    default:
      return {
        x: v.x,
        y: v.y
      };
  }
}

/**
 * Peak-hold envelope for a spiky signal: a sample at least as large as what
 * is held replaces it instantly (attack), anything smaller lets the held
 * value decay by `release` per step.
 */
export function envelope(
  held, sample, release
) {
  return Math.abs( sample ) >= Math.abs( held ) ? sample : held * release;
}

/**
 * Exponential smoothing of a unit vector; the first sample passes through.
 */
export function smoothVector(
  previous, next, smoothing
) {
  if ( !previous || smoothing <= 0 ) {
    return {
      x: next.x,
      y: next.y
    };
  }

  const keep = 1 - smoothing;

  return {
    x: previous.x + ( next.x - previous.x ) * keep,
    y: previous.y + ( next.y - previous.y ) * keep
  };
}

/**
 * Map a unit vector onto the canvas: (0, 0) is the centre, (±1, ±1) the
 * edges. Clamped to the canvas, THEN offset — the offset is meant to shift the
 * whole pointer field, so it may push it off-canvas on purpose.
 */
export function toCanvas(
  v, width, height, offset = {
    x: 0,
    y: 0
  }
) {
  return {
    x: clamp(
      width / 2 + v.x * width / 2,
      0,
      width
    ) + ( offset.x ?? 0 ),
    y: clamp(
      height / 2 + v.y * height / 2,
      0,
      height
    ) + ( offset.y ?? 0 )
  };
}

export function freshGyroState() {
  return {
    // The pose that reads as the canvas centre (tilt / gravity), captured
    // from the first reading in `auto` calibration; null until then.
    neutral: null,
    // Last output unit vector, the EMA's memory and the same-frame answer.
    smoothed: null,
    // Integrated pointer for the rotation mode.
    position: {
      x: 0,
      y: 0
    },
    // Peak-hold envelope for the acceleration mode.
    held: {
      x: 0,
      y: 0
    },
    // The mode + calibration the state was built for; a change resets it.
    signature: "",
    // Frame guard: the collector runs several times per frame (legend,
    // crosshairs, markers), and the integrators must advance once.
    frame: -1
  };
}

/** Forget the captured neutral pose so the next reading becomes the centre. */
export function recalibrate( state ) {
  state.neutral = null;
}

function resolveNeutral(
  state, orientation, options
) {
  if ( options.calibration === "flat" ) {
    return {
      beta: 0,
      gamma: 0
    };
  }

  if ( options.calibration === "custom" ) {
    return options.neutral;
  }

  if ( !state.neutral ) {
    state.neutral = {
      beta: orientation.beta,
      gamma: orientation.gamma
    };
  }

  return state.neutral;
}

function rawVector(
  state, reading, options, dtSeconds
) {
  switch ( options.mode ) {
    case "tilt":
    case "gravity": {
      const orientation = reading.orientation;

      if ( !orientation ) {
        return null;
      }

      const neutral = resolveNeutral(
        state,
        orientation,
        options
      );

      if ( options.mode === "tilt" ) {
        return {
          x: angleDelta(
            orientation.gamma,
            neutral.gamma
          ) / options.range,
          y: angleDelta(
            orientation.beta,
            neutral.beta
          ) / options.range
        };
      }

      const gravity = gravityFromOrientation(
        orientation.beta,
        orientation.gamma
      );
      const rest = gravityFromOrientation(
        neutral.beta,
        neutral.gamma
      );

      return {
        x: ( gravity.x - rest.x ) / options.range,
        y: ( gravity.y - rest.y ) / options.range
      };
    }

    case "acceleration": {
      const acceleration = reading.acceleration;

      if ( !acceleration ) {
        return null;
      }

      // Device y points UP the screen; canvas y points down.
      state.held = {
        x: envelope(
          state.held.x,
          acceleration.x,
          options.release
        ),
        y: envelope(
          state.held.y,
          -acceleration.y,
          options.release
        )
      };

      return {
        x: state.held.x / options.range,
        y: state.held.y / options.range
      };
    }

    case "rotation": {
      const rate = reading.rotationRate;

      if ( !rate ) {
        return null;
      }

      const step = ( degreesPerSecond ) => ( Math.abs( degreesPerSecond ) < options.deadzone
        ? 0
        : degreesPerSecond * dtSeconds / options.range );

      state.position = {
        x: clampUnit( state.position.x + step( rate.gamma ) ),
        y: clampUnit( state.position.y + step( rate.beta ) )
      };

      return {
        x: state.position.x,
        y: state.position.y
      };
    }

    default:
      return null;
  }
}

/**
 * One step of the gyroscope pointer, for the current frame.
 *
 * @param {ReturnType<typeof freshGyroState>} state - mutated in place
 * @param {object} reading - the latest sensor values, any of them null when
 *   nothing has arrived: `orientation` { beta, gamma } (degrees),
 *   `acceleration` { x, y } (m/s², the peak since the previous frame),
 *   `rotationRate` { beta, gamma } (°/s), `screenAngle` (degrees).
 * @param {ReturnType<typeof normalizeGyroOptions>} options
 * @param {number} [frame=-1] - the frame counter; the same frame twice
 *   returns the same output without advancing the state.
 * @param {number} [dtSeconds=0] - time since the previous frame (rotation).
 * @returns {{ x: number, y: number } | null} a unit vector, or null while the
 *   mode's sensor has produced nothing — a channel that is not there
 *   publishes nothing, never a centred zero.
 */
export function stepGyroscope(
  state, reading, options, frame = -1, dtSeconds = 0
) {
  const signature = [
    options.mode,
    options.calibration,
    options.neutral.beta,
    options.neutral.gamma
  ].join( "|" );

  if ( signature !== state.signature ) {
    const fresh = freshGyroState();

    fresh.signature = signature;
    Object.assign(
      state,
      fresh
    );
  }

  if ( frame >= 0 && frame === state.frame && state.smoothed ) {
    return {
      x: state.smoothed.x,
      y: state.smoothed.y
    };
  }

  const raw = rawVector(
    state,
    reading,
    options,
    dtSeconds
  );

  if ( !raw ) {
    return null;
  }

  state.frame = frame;

  const rotated = options.screenRotation
    ? rotateForScreen(
      raw,
      reading.screenAngle ?? 0
    )
    : raw;
  const oriented = {
    x: clampUnit( options.invert.x ? -rotated.x : rotated.x ),
    y: clampUnit( options.invert.y ? -rotated.y : rotated.y )
  };

  state.smoothed = smoothVector(
    state.smoothed,
    oriented,
    options.smoothing
  );

  return {
    x: state.smoothed.x,
    y: state.smoothed.y
  };
}
