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

// Raw mouse/touch: tracked via window listeners so coordinates are correct
// even when the canvas is panned/zoomed inside ScalableViewport (CSS transform).
const _rawMouse = {
  clientX: null,
  clientY: null
};
let _rawTouches = []; // Array of { clientX, clientY }

let _noiseOffset = 0;
const _smoothedMouse = {
  x: 0,
  y: 0
};
const _gyro = {
  beta: 0,
  gamma: 0
};

// Listeners
let _gyroListener = null;
let _pointerMoveListener = null;
let _touchListeners = null;

// MIDI state
let _midiInitialized = false;
let _midiAccess = null;
const _midiNotes = new Map(); // noteNumber → velocity

// Audio state
let _audioInitialized = false;
let _audioContext = null;
let _audioAnalyser = null;
let _audioFreqData = null;

// ── Coordinate conversion ──────────────────────────────────────────────────

/**
 * Convert viewport-space clientX/clientY to p5 canvas-space coordinates.
 * Uses getBoundingClientRect() so it correctly accounts for any CSS transforms
 * (e.g. the ScalableViewport's translate/scale) applied to the canvas's ancestors.
 */
function _clientToCanvas(
  clientX, clientY, p
) {
  if ( typeof document === "undefined" ) {
    return {
      x: 0,
      y: 0
    };
  }

  const canvas = document.querySelector( "canvas.p5Canvas" );

  if ( !canvas ) {
    return {
      x: 0,
      y: 0
    };
  }

  const rect = canvas.getBoundingClientRect();

  if ( rect.width === 0 || rect.height === 0 ) {
    return {
      x: 0,
      y: 0
    };
  }

  return {
    x: ( clientX - rect.left ) * ( p.width / rect.width ),
    y: ( clientY - rect.top ) * ( p.height / rect.height )
  };
}

// ── MIDI helpers ───────────────────────────────────────────────────────────

function _wireMidiInputs() {
  if ( !_midiAccess ) {
    return;
  }

  _midiAccess.inputs.forEach( ( input ) => {
    input.onmidimessage = _onMidiMessage;
  } );
}

function _onMidiMessage( msg ) {
  if ( !msg.data || msg.data.length < 3 ) {
    return;
  }

  const command = msg.data[ 0 ] & 0xf0;
  const note = msg.data[ 1 ];
  const velocity = msg.data[ 2 ];

  if ( command === 0x90 && velocity > 0 ) {
    _midiNotes.set(
      note,
      velocity
    );
  } else if ( command === 0x80 || ( command === 0x90 && velocity === 0 ) ) {
    _midiNotes.delete( note );
  }
}

async function _initMidi() {
  if ( _midiInitialized ) {
    return;
  }

  _midiInitialized = true;

  if ( typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function" ) {
    return;
  }

  try {
    _midiAccess = await navigator.requestMIDIAccess();
    _wireMidiInputs();
    _midiAccess.onstatechange = () => _wireMidiInputs();
  } catch {
    // Permission denied or MIDI not available
  }
}

// ── Audio helpers ──────────────────────────────────────────────────────────

async function _initAudio( opts ) {
  if ( _audioInitialized ) {
    return;
  }

  _audioInitialized = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia( {
      audio: true,
      video: false
    } );
    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    _audioContext = new AudioCtx();
    _audioAnalyser = _audioContext.createAnalyser();
    _audioAnalyser.fftSize = opts.audio?.fftSize ?? 1024;
    _audioAnalyser.smoothingTimeConstant = opts.audio?.smoothing ?? 0.8;

    const source = _audioContext.createMediaStreamSource( stream );

    source.connect( _audioAnalyser );
    _audioFreqData = new Uint8Array( _audioAnalyser.frequencyBinCount );
  } catch {
    // Microphone permission denied or not available
  }
}

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

  // ── Gyroscope ────────────────────────────────────────────────────────────
  if ( _gyroListener && typeof window !== "undefined" ) {
    window.removeEventListener(
      "deviceorientation",
      _gyroListener
    );
    _gyroListener = null;
  }

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

  // ── Raw mouse / touch tracking ───────────────────────────────────────────
  // We track raw clientX/Y ourselves so _clientToCanvas() can give correct
  // canvas-space coordinates regardless of CSS transforms in ScalableViewport.
  if ( typeof window !== "undefined" ) {
    // Remove stale listeners from a previous initInteraction call
    if ( _pointerMoveListener ) {
      window.removeEventListener(
        "pointermove",
        _pointerMoveListener
      );
    }

    _rawMouse.clientX = null;
    _rawMouse.clientY = null;

    _pointerMoveListener = ( e ) => {
      _rawMouse.clientX = e.clientX;
      _rawMouse.clientY = e.clientY;
    };
    window.addEventListener(
      "pointermove",
      _pointerMoveListener,
      {
        passive: true
      }
    );

    if ( _touchListeners ) {
      window.removeEventListener(
        "touchstart",
        _touchListeners.fn
      );
      window.removeEventListener(
        "touchmove",
        _touchListeners.fn
      );
      window.removeEventListener(
        "touchend",
        _touchListeners.fn
      );
    }

    _rawTouches = [];

    const _onTouch = ( e ) => {
      _rawTouches = Array.from( e.touches ).map( ( t ) => ( {
        clientX: t.clientX,
        clientY: t.clientY
      } ) );
    };

    _touchListeners = {
      fn: _onTouch
    };
    window.addEventListener(
      "touchstart",
      _onTouch,
      {
        passive: true
      }
    );
    window.addEventListener(
      "touchmove",
      _onTouch,
      {
        passive: true
      }
    );
    window.addEventListener(
      "touchend",
      _onTouch,
      {
        passive: true
      }
    );
  }

  // ── MIDI reset (lazy init triggered by _collectMidi) ─────────────────────
  if ( _midiAccess ) {
    _midiAccess.inputs.forEach( ( input ) => {
      input.onmidimessage = null;
    } );
  }

  _midiAccess = null;
  _midiInitialized = false;
  _midiNotes.clear();

  // ── Audio reset (lazy init triggered by _collectAudio) ───────────────────
  if ( _audioContext ) {
    _audioContext.close().catch( () => {} );
    _audioContext = null;
    _audioAnalyser = null;
    _audioFreqData = null;
  }

  _audioInitialized = false;

  // ── MediaPipe ────────────────────────────────────────────────────────────
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
 * Call when tearing down the sketch to remove event listeners and free resources.
 */
export function disposeInteraction() {
  if ( typeof window === "undefined" ) {
    return;
  }

  // Gyroscope
  if ( _gyroListener ) {
    window.removeEventListener(
      "deviceorientation",
      _gyroListener
    );
    _gyroListener = null;
  }

  // Mouse
  if ( _pointerMoveListener ) {
    window.removeEventListener(
      "pointermove",
      _pointerMoveListener
    );
    _pointerMoveListener = null;
  }

  _rawMouse.clientX = null;
  _rawMouse.clientY = null;

  // Touch
  if ( _touchListeners ) {
    window.removeEventListener(
      "touchstart",
      _touchListeners.fn
    );
    window.removeEventListener(
      "touchmove",
      _touchListeners.fn
    );
    window.removeEventListener(
      "touchend",
      _touchListeners.fn
    );
    _touchListeners = null;
  }

  _rawTouches = [];

  // MIDI
  if ( _midiAccess ) {
    _midiAccess.inputs.forEach( ( input ) => {
      input.onmidimessage = null;
    } );
    _midiAccess = null;
  }

  _midiInitialized = false;
  _midiNotes.clear();

  // Audio
  if ( _audioContext ) {
    _audioContext.close().catch( () => {} );
    _audioContext = null;
    _audioAnalyser = null;
    _audioFreqData = null;
  }

  _audioInitialized = false;
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
  _syncVisionEnabled( opts );
  _collectHands(
    opts,
    p,
    vectors
  );
  _collectFace(
    opts,
    p,
    vectors
  );
  _collectBody(
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
  _collectMidi(
    opts,
    p,
    vectors
  );
  _collectAudio(
    opts,
    p,
    vectors
  );
  _collectJoypad(
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

  _syncVisionEnabled( opts );

  const h = [];

  _collectHands(
    opts,
    p,
    h
  ); push(
    "hands",
    h
  );

  const f = [];

  _collectFace(
    opts,
    p,
    f
  ); push(
    "face",
    f
  );

  const b = [];

  _collectBody(
    opts,
    p,
    b
  ); push(
    "body",
    b
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

  const mid = [];

  _collectMidi(
    opts,
    p,
    mid
  ); push(
    "midi",
    mid
  );

  const aud = [];

  _collectAudio(
    opts,
    p,
    aud
  ); push(
    "audio",
    aud
  );

  const joy = [];

  _collectJoypad(
    opts,
    p,
    joy
  ); push(
    "joypad",
    joy
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

  // Use raw client coordinates converted through getBoundingClientRect() so
  // the result is correct even when ScalableViewport has panned/zoomed the
  // canvas (CSS transform on the parent doesn't affect the formula).
  let rawX, rawY;

  if ( _rawMouse.clientX === null ) {
    // No pointermove yet — fall back to p5's values for the first frame
    rawX = p.mouseX;
    rawY = p.mouseY;
  } else {
    const coords = _clientToCanvas(
      _rawMouse.clientX,
      _rawMouse.clientY,
      p
    );

    rawX = coords.x;
    rawY = coords.y;
  }

  if ( smoothing > 0 ) {
    _smoothedMouse.x = p.lerp(
      _smoothedMouse.x,
      rawX,
      1 - smoothing
    );
    _smoothedMouse.y = p.lerp(
      _smoothedMouse.y,
      rawY,
      1 - smoothing
    );
    out.push( p.createVector(
      _smoothedMouse.x + ox,
      _smoothedMouse.y + oy
    ) );
  } else {
    out.push( p.createVector(
      rawX + ox,
      rawY + oy
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
  const count = Math.min(
    _rawTouches.length,
    maxTouches
  );

  for ( let i = 0; i < count; i++ ) {
    const {
      x, y
    } = _clientToCanvas(
      _rawTouches[ i ].clientX,
      _rawTouches[ i ].clientY,
      p
    );

    out.push( p.createVector(
      x,
      y
    ) );
  }
}

// Sync the mediapipe enabled state based on current options.
// Must be called once per frame before the vision collectors.
function _syncVisionEnabled( opts ) {
  const vision = opts.vision;
  const anyVision = vision?.enabled !== false &&
    ( vision?.hands?.enabled || vision?.face?.enabled || vision?.body?.enabled );

  setMediapipeEnabled( !!anyVision );
}

function _collectHands(
  opts, p, out
) {
  const vision = opts.vision;
  const hands = vision?.hands;

  if ( vision?.enabled === false || !hands?.enabled ) {
    return;
  }

  const flip = vision?.camera?.flip ?? true;
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

function _collectFace(
  opts, p, out
) {
  const vision = opts.vision;
  const face = vision?.face;

  if ( vision?.enabled === false || !face?.enabled ) {
    return;
  }

  const flip = vision?.camera?.flip ?? true;
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

function _collectBody(
  opts, p, out
) {
  const vision = opts.vision;
  const body = vision?.body;

  if ( vision?.enabled === false || !body?.enabled ) {
    return;
  }

  const flip = vision?.camera?.flip ?? true;
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

function _collectMidi(
  opts, p, out
) {
  const midi = opts.midi;

  if ( !midi?.enabled ) {
    return;
  }

  // Trigger lazy MIDI access request on first call
  if ( !_midiInitialized ) {
    _initMidi();

    return;
  }

  const maxNotes = midi.maxNotes ?? 10;
  let count = 0;

  for ( const [ note, velocity ] of _midiNotes ) {
    if ( count >= maxNotes ) {
      break;
    }

    // Note number (0–127) → X, velocity (0–127) → Y (loud = top)
    out.push( p.createVector(
      p.map(
        note,
        0,
        127,
        0,
        p.width
      ),
      p.map(
        velocity,
        0,
        127,
        p.height,
        0
      )
    ) );
    count++;
  }
}

function _collectAudio(
  opts, p, out
) {
  const audio = opts.audio;

  if ( !audio?.enabled ) {
    return;
  }

  // Trigger lazy mic request on first call
  if ( !_audioInitialized ) {
    _initAudio( opts );

    return;
  }

  if ( !_audioAnalyser || !_audioFreqData ) {
    return;
  }

  // Resume AudioContext if it was suspended (browsers require user gesture)
  if ( _audioContext?.state === "suspended" ) {
    _audioContext.resume().catch( () => {} );
  }

  _audioAnalyser.getByteFrequencyData( _audioFreqData );

  const count = audio.count ?? 1;
  const margin = audio.margin ?? 50;
  const bins = _audioFreqData.length;

  for ( let i = 0; i < count; i++ ) {
    const binStart = Math.floor( i * bins / count );
    const binEnd = Math.floor( ( i + 1 ) * bins / count );
    let sum = 0;

    for ( let b = binStart; b < binEnd; b++ ) {
      sum += _audioFreqData[ b ];
    }

    const avg = sum / Math.max(
      1,
      binEnd - binStart
    );

    // X = evenly spaced across canvas, Y = amplitude (loud = top, quiet = bottom)
    out.push( p.createVector(
      p.map(
        i + 0.5,
        0,
        count,
        margin,
        p.width - margin
      ),
      p.map(
        avg,
        0,
        255,
        p.height - margin,
        margin
      )
    ) );
  }
}

function _collectJoypad(
  opts, p, out
) {
  const joypad = opts.joypad;

  if ( !joypad?.enabled ) {
    return;
  }

  if ( typeof navigator.getGamepads !== "function" ) {
    return;
  }

  const gamepads = navigator.getGamepads();
  const maxCount = joypad.count ?? 1;
  const deadzone = joypad.deadzone ?? 0.1;
  let added = 0;

  for ( let i = 0; i < gamepads.length && added < maxCount; i++ ) {
    const gp = gamepads[ i ];

    if ( !gp || !gp.connected ) {
      continue;
    }

    // Left stick: axes[0] = X, axes[1] = Y
    let axisX = gp.axes[ 0 ] ?? 0;
    let axisY = gp.axes[ 1 ] ?? 0;

    if ( Math.abs( axisX ) < deadzone ) {
      axisX = 0;
    }

    if ( Math.abs( axisY ) < deadzone ) {
      axisY = 0;
    }

    out.push( p.createVector(
      p.map(
        axisX,
        -1,
        1,
        0,
        p.width
      ),
      p.map(
        axisY,
        -1,
        1,
        0,
        p.height
      )
    ) );
    added++;
  }
}
