import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import mediapipe, {
  init as mediapipeInit,
  setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

// ── Hand landmark indices ──────────────────────────────────────────────────
// Fingertip indices: thumb, index, middle, ring, pinky
export const HAND_FINGERTIP_INDICES = [
  4,
  8,
  12,
  16,
  20
];
export const HAND_PALM_INDEX = 0;

// ── Body pose landmark indices (MediaPipe Pose) ────────────────────────────
export const BODY_WRIST_INDICES = [
  15,
  16
];
export const BODY_ELBOW_INDICES = [
  13,
  14
];
export const BODY_SHOULDER_INDICES = [
  11,
  12
];
export const BODY_HIP_INDICES = [
  23,
  24
];

// ── Module-level state ─────────────────────────────────────────────────────
let _noiseOffset = 0;
const _smoothedMouse = {
  x: 0,
  y: 0
};
const _gyro = {
  beta: 0,
  gamma: 0
};
let _gyroListener = null;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Call once in sketch.setup().
 * Starts the webcam and the mediapipe tasks needed by the given options,
 * and wires up the gyroscope listener if needed.
 *
 * @param {object} opts - The `interaction` section of sketch options
 */
export async function initInteraction( opts = {} ) {
  const vision = opts.vision ?? {};
  const interactionEnabled = opts.enabled !== false;
  const visionEnabled = interactionEnabled && vision.enabled !== false;
  const tasks = [];

  if ( visionEnabled ) {
    if ( vision.hands?.enabled ) {
      tasks.push( "hands" );
    }
    if ( vision.body?.enabled ) {
      tasks.push( "poses" );
    }
    if ( vision.face?.enabled ) {
      tasks.push( "faces" );
    }
  }

  _noiseOffset = opts.perlinNoise?.seed ?? 0;

  if ( opts.gyroscope?.enabled && typeof window !== "undefined" ) {
    _gyroListener = ( e ) => {
      _gyro.beta = e.beta ?? 0;
      _gyro.gamma = e.gamma ?? 0;
    };
    window.addEventListener(
      "deviceorientation",
      _gyroListener
    );
  }

  if ( tasks.length > 0 ) {
    const cam = vision.camera ?? {};

    await mediapipeInit( {
      worker: false,
      tasks,
      captureSize: {
        width: cam.width ?? 320,
        height: cam.height ?? 240
      },
      captureFlip: cam.flip ?? true
    } );
  }
}

/**
 * Call when tearing down the sketch to remove the gyroscope listener.
 */
export function disposeInteraction() {
  if ( _gyroListener && typeof window !== "undefined" ) {
    window.removeEventListener(
      "deviceorientation",
      _gyroListener
    );
    _gyroListener = null;
  }
}

/**
 * Returns all active pointer vectors for this frame, merged from all
 * enabled sources.  Safe to call every frame inside sketch.draw().
 *
 * @param {object} opts - The `interaction` section of sketch options
 * @returns {import("p5").Vector[]}
 */
export function getPointers( opts ) {
  const p = getP5();

  if ( !opts || opts.enabled === false ) {
    return [];
  }

  const vectors = [];

  _collectMouse(
    opts,
    p,
    vectors
  );
  _collectTouch(
    opts,
    p,
    vectors
  );
  _collectVision(
    opts,
    p,
    vectors
  );
  _collectOrbit(
    opts,
    p,
    vectors
  );
  _collectPerlinNoise(
    opts,
    p,
    vectors
  );
  _collectGyroscope(
    opts,
    p,
    vectors
  );

  return vectors;
}

/**
 * Like getPointers() but each item carries a `source` label.
 * Intended for the interaction-test debug sketch — not needed in production.
 *
 * @param {object} opts - The `interaction` section of sketch options
 * @returns {Array<{ vector: import("p5").Vector, source: string }>}
 */
export function getPointersDebug( opts ) {
  const p = getP5();

  if ( !opts || opts.enabled === false ) {
    return [];
  }

  const tagged = [];

  const push = (
    source, arr
  ) =>
    arr.forEach( ( v ) => tagged.push( {
      vector: v,
      source
    } ) );

  const m = [];

  _collectMouse(
    opts,
    p,
    m
  ); push(
    "mouse",
    m
  );
  const t = [];

  _collectTouch(
    opts,
    p,
    t
  ); push(
    "touch",
    t
  );
  const v = [];

  _collectVision(
    opts,
    p,
    v
  ); push(
    "vision",
    v
  );
  const o = [];

  _collectOrbit(
    opts,
    p,
    o
  ); push(
    "orbit",
    o
  );
  const n = [];

  _collectPerlinNoise(
    opts,
    p,
    n
  ); push(
    "perlinNoise",
    n
  );
  const g = [];

  _collectGyroscope(
    opts,
    p,
    g
  ); push(
    "gyroscope",
    g
  );

  return tagged;
}

// ── Private source collectors ──────────────────────────────────────────────

function _collectMouse(
  opts, p, out
) {
  const mouse = opts.mouse;

  if ( !mouse?.enabled ) {
    return;
  }

  const ox = mouse.offsetX ?? 0;
  const oy = mouse.offsetY ?? 0;
  const smoothing = mouse.smoothing ?? 0;

  if ( smoothing > 0 ) {
    _smoothedMouse.x = p.lerp(
      _smoothedMouse.x,
      p.mouseX,
      1 - smoothing
    );
    _smoothedMouse.y = p.lerp(
      _smoothedMouse.y,
      p.mouseY,
      1 - smoothing
    );
    out.push( p.createVector(
      _smoothedMouse.x + ox,
      _smoothedMouse.y + oy
    ) );
  } else {
    out.push( p.createVector(
      p.mouseX + ox,
      p.mouseY + oy
    ) );
  }
}

function _collectTouch(
  opts, p, out
) {
  const touch = opts.touch;

  if ( !touch?.enabled ) {
    return;
  }

  const maxTouches = touch.maxTouches ?? 5;
  const touches = p.touches ?? [];
  const count = Math.min(
    touches.length,
    maxTouches
  );

  for ( let i = 0; i < count; i++ ) {
    out.push( p.createVector(
      touches[ i ].x,
      touches[ i ].y
    ) );
  }
}

function _collectVision(
  opts, p, out
) {
  const vision = opts.vision;
  const anyVision = vision?.enabled !== false &&
                      ( vision?.hands?.enabled || vision?.face?.enabled || vision?.body?.enabled );

  setMediapipeEnabled( !!anyVision );

  if ( !anyVision ) {
    return;
  }

  const flip = vision?.camera?.flip ?? true;

  // ── Hands ────────────────────────────────────────────────────────────────
  const hands = vision?.hands;

  if ( hands?.enabled ) {
    const lm = hands.landmarks ?? {};
    const maxHands = hands.maxHands ?? 2;
    const results = mediapipe.tasks?.hands?.result?.landmarks ?? [];

    results.slice(
      0,
      maxHands
    ).forEach( ( hand ) => {
      if ( lm.fingertips !== false ) {
        HAND_FINGERTIP_INDICES.forEach( ( i ) => {
          const pt = hand[ i ];

          if ( !pt ) {
            return;
          }
          out.push( p.createVector(
            ( flip ? common.inverseX( pt.x ) : pt.x ) * p.width,
            pt.y * p.height
          ) );
        } );
      }

      if ( lm.palm ) {
        const pt = hand[ HAND_PALM_INDEX ];

        if ( pt ) {
          out.push( p.createVector(
            ( flip ? common.inverseX( pt.x ) : pt.x ) * p.width,
            pt.y * p.height
          ) );
        }
      }
    } );
  }

  // ── Face ─────────────────────────────────────────────────────────────────
  const face = vision?.face;

  if ( face?.enabled ) {
    const detections = mediapipe.tasks?.faces?.result?.detections ?? [];
    const maxFaces = face.maxFaces ?? 1;
    const capW = mediapipe.capture?.size?.width ?? 320;
    const capH = mediapipe.capture?.size?.height ?? 240;

    detections.slice(
      0,
      maxFaces
    ).forEach( ( det ) => {
      const bbox = det.boundingBox;

      if ( !bbox ) {
        return;
      }

      // FaceDetector returns pixel-space bbox relative to capture size
      const cx = ( bbox.originX + bbox.width / 2 ) / capW;
      const cy = ( bbox.originY + bbox.height / 2 ) / capH;

      out.push( p.createVector(
        ( flip ? 1 - cx : cx ) * p.width,
        cy * p.height
      ) );
    } );
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = vision?.body;

  if ( body?.enabled ) {
    const lm = body.landmarks ?? {};
    const maxPoses = body.maxPoses ?? 1;
    const minConf = body.confidence ?? 0.3;
    const results = mediapipe.tasks?.poses?.result?.landmarks ?? [];

    results.slice(
      0,
      maxPoses
    ).forEach( ( pose ) => {
      const indices = [];

      if ( lm.wrists !== false ) {
        indices.push( ...BODY_WRIST_INDICES );
      }
      if ( lm.elbows ) {
        indices.push( ...BODY_ELBOW_INDICES );
      }
      if ( lm.shoulders ) {
        indices.push( ...BODY_SHOULDER_INDICES );
      }
      if ( lm.hips ) {
        indices.push( ...BODY_HIP_INDICES );
      }

      indices.forEach( ( i ) => {
        const pt = pose[ i ];

        if ( !pt ) {
          return;
        }
        if ( ( pt.visibility ?? 1 ) < minConf ) {
          return;
        }

        out.push( p.createVector(
          ( flip ? common.inverseX( pt.x ) : pt.x ) * p.width,
          pt.y * p.height
        ) );
      } );
    } );
  }
}

function _collectOrbit(
  opts, p, out
) {
  const orbit = opts.orbit;

  if ( !orbit?.enabled ) {
    return;
  }

  const count = orbit.count ?? 1;
  const margin = orbit.margin ?? 150;
  const speed = orbit.speed ?? 1;
  const sinAMul = orbit.sinAngleMultiplier ?? 2;
  const cosAMul = orbit.cosAngleMultiplier ?? 1;
  const sinPMul = orbit.sinProgressionMultiplier ?? 1;
  const cosPMul = orbit.cosProgressionMultiplier ?? 4;
  const W = p.width - margin;
  const H = p.height - margin;
  const angle = animation.angle * speed;

  for ( let i = 0; i < count; i++ ) {
    const t = count > 1 ? i / count : 0;

    out.push( p.createVector(
      p.map(
        Math.sin( angle * sinAMul + t * sinPMul ),
        -1,
        1,
        margin,
        W
      ),
      p.map(
        Math.cos( angle * cosAMul + t * cosPMul ),
        -1,
        1,
        margin,
        H
      )
    ) );
  }
}

function _collectPerlinNoise(
  opts, p, out
) {
  const noise = opts.perlinNoise;

  if ( !noise?.enabled ) {
    return;
  }

  const count = noise.count ?? 3;
  const speed = noise.speed ?? 0.005;
  const margin = noise.margin ?? 50;

  _noiseOffset += speed;

  for ( let i = 0; i < count; i++ ) {
    out.push( p.createVector(
      p.map(
        p.noise(
          _noiseOffset + i * 100,
          0
        ),
        0,
        1,
        margin,
        p.width - margin
      ),
      p.map(
        p.noise(
          _noiseOffset + i * 100,
          1000
        ),
        0,
        1,
        margin,
        p.height - margin
      )
    ) );
  }
}

function _collectGyroscope(
  opts, p, out
) {
  const gyro = opts.gyroscope;

  if ( !gyro?.enabled ) {
    return;
  }

  const clamp = gyro.clampAngle ?? 45;

  out.push( p.createVector(
    p.constrain(
      p.map(
        _gyro.gamma,
        -clamp,
        clamp,
        0,
        p.width
      ),
      0,
      p.width
    ),
    p.constrain(
      p.map(
        _gyro.beta,
        -clamp,
        clamp,
        0,
        p.height
      ),
      0,
      p.height
    )
  ) );
}
