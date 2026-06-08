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

// Anatomical order so a per-pose group draws as one connected ribbon: down the
// left arm, across the torso and back up the right arm.
const BODY_CHAIN = [
  15, // left wrist
  13, // left elbow
  11, // left shoulder
  23, // left hip
  24, // right hip
  12, // right shoulder
  14, // right elbow
  16 // right wrist
];

// Which landmark toggle each chain index belongs to.
const BODY_CHAIN_GROUP = {
  11: "shoulders",
  12: "shoulders",
  13: "elbows",
  14: "elbows",
  15: "wrists",
  16: "wrists",
  23: "hips",
  24: "hips"
};

// BlazeFace returns 6 keypoints per face. Walk them as an arc that reads like a
// face sweep rather than the raw detector order.
//   0 right eye · 1 left eye · 2 nose tip · 3 mouth · 4 right ear · 5 left ear
const FACE_KEYPOINT_ORDER = [
  4, // right ear
  0, // right eye
  2, // nose tip
  3, // mouth
  1, // left eye
  5 // left ear
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

// Vision lazy-init state: the task/camera signature currently initialized, plus
// an in-flight guard so we never kick off two mediapipe initializations at once.
let _visionSignature = "";
let _visionInitInFlight = null;

// Temporal smoothing state for getPointerGroups, keyed by `${groupId}:${index}`.
const _groupSmoothing = new Map();

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
  // Pre-warm vision when a camera tracker is already enabled at setup. The same
  // routine also runs every frame from getPointers()/getPointerGroups(), so
  // toggling a tracker on at runtime now starts the camera without a reload.
  await _ensureVision( opts );
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

  // Vision / webcam
  setMediapipeEnabled( false );
  _visionSignature = "";
  _visionInitInFlight = null;
  _groupSmoothing.clear();
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
  _ensureVision( opts );
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

  _ensureVision( opts );

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

/**
 * Like getPointers() but returns ORDERED, per-entity groups instead of one flat
 * list — each group is meant to become a single continuous stroke/spline.
 *
 *   - hands  → one group per detected hand  (palm → fingertips, thumb→pinky)
 *   - body   → one group per detected pose  (wrist→elbow→shoulder→…→wrist)
 *   - face   → one group per detected face  (ear→eye→nose→mouth→eye→ear arc)
 *   - orbit / perlinNoise / audio / touch / midi / joypad / mouse / gyroscope
 *            → one group holding that source's points
 *
 * Set `opts.smoothing` (0..1) to temporally smooth each group/point so jittery
 * camera landmarks produce calm curves.
 *
 * @param {object} opts - The `interaction` section of sketch options
 * @returns {Array<{ source: string, id: string, points: import("p5").Vector[] }>}
 */
export function getPointerGroups( opts ) {
  const p = getP5();

  if ( !opts || opts.enabled === false ) {
    return [];
  }

  _ensureVision( opts );

  const groups = [];

  const addFlat = (
    source, collector
  ) => {
    const points = [];

    collector(
      opts,
      p,
      points
    );

    if ( points.length > 0 ) {
      groups.push( {
        source,
        id: source,
        points
      } );
    }
  };

  addFlat(
    "mouse",
    _collectMouse
  );
  addFlat(
    "touch",
    _collectTouch
  );

  // Vision: one ordered group per detected entity.
  _collectHandGroups(
    opts,
    p,
    groups
  );
  _collectBodyGroups(
    opts,
    p,
    groups
  );
  _collectFaceGroups(
    opts,
    p,
    groups
  );

  addFlat(
    "orbit",
    _collectOrbit
  );
  addFlat(
    "perlinNoise",
    _collectPerlinNoise
  );
  addFlat(
    "gyroscope",
    _collectGyroscope
  );
  addFlat(
    "midi",
    _collectMidi
  );
  addFlat(
    "audio",
    _collectAudio
  );
  addFlat(
    "joypad",
    _collectJoypad
  );

  return _smoothGroups(
    groups,
    opts.smoothing ?? 0
  );
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

// The MediaPipe task names wanted by the current options.
function _desiredVisionTasks( opts ) {
  const vision = opts.vision;

  if ( !vision || vision.enabled === false ) {
    return [];
  }

  const tasks = [];

  if ( vision.hands?.enabled ) {
    tasks.push( "hands" );
  }

  if ( vision.body?.enabled ) {
    tasks.push( "poses" );
  }

  if ( vision.face?.enabled ) {
    tasks.push( "faces" );
  }

  return tasks;
}

// A stable key describing the vision configuration. Re-initialization is needed
// whenever this changes (different trackers, camera size or mirror setting).
function _visionSignatureFor(
  opts, tasks
) {
  const cam = opts.vision?.camera ?? {};

  return [
    tasks.join( "+" ),
    cam.width ?? 320,
    cam.height ?? 240,
    cam.flip ?? true
  ].join( ":" );
}

// Lazily (re)initialize MediaPipe to match the current vision options.
//
// The previous implementation only ever called mediapipeInit() from setup(), so
// enabling a camera tracker at runtime never created the VisionManager and
// nothing was detected (only setEnabled() ran, which can't bootstrap the
// processor). Running this cheaply every frame fixes that: it boots the
// processor the first time a tracker is switched on, re-inits when the task set
// or camera changes, and releases the webcam once every tracker is off.
// Safe to call each frame — it no-ops while the requested configuration is live.
function _ensureVision( opts ) {
  // An init is already running — let it settle; we reconcile next frame.
  if ( _visionInitInFlight ) {
    return _visionInitInFlight;
  }

  const tasks = _desiredVisionTasks( opts );

  // Nothing requested → release the webcam if we currently hold it.
  if ( tasks.length === 0 ) {
    if ( _visionSignature !== "" ) {
      setMediapipeEnabled( false );
      _visionSignature = "";
    }

    return Promise.resolve();
  }

  const signature = _visionSignatureFor(
    opts,
    tasks
  );

  // Already live for this exact configuration → keep it enabled (idempotent).
  if ( signature === _visionSignature && mediapipe.processor.ready ) {
    setMediapipeEnabled( true );

    return Promise.resolve();
  }

  // (Re)initialize. Release any previous webcam first so switching task sets
  // (e.g. hands → hands + body) doesn't leak the old <video> element.
  if ( mediapipe.capture.element ) {
    setMediapipeEnabled( false );
  }

  _visionSignature = signature;

  const cam = opts.vision?.camera ?? {};

  _visionInitInFlight = mediapipeInit( {
    worker: false,
    tasks,
    captureSize: {
      width: cam.width ?? 320,
      height: cam.height ?? 240
    },
    captureFlip: cam.flip ?? true
  } )
    .then( () =>
      // init() doesn't restore mediapipe.enabled after a prior deallocate, so
      // flip it back on explicitly to make sure frames actually get sent.
      setMediapipeEnabled( true ) )
    .catch( () => {
      // Allow a later retry (e.g. if the camera permission was denied).
      _visionSignature = "";
    } )
    .finally( () => {
      _visionInitInFlight = null;
    } );

  return _visionInitInFlight;
}

// Convert a MediaPipe normalized landmark (0..1) to p5 canvas space, honouring
// the camera mirror setting. Shared by the hand/body collectors and groups.
function _normToCanvas(
  pt, flip, p
) {
  return p.createVector(
    ( flip ? common.inverseX( pt.x ) : pt.x ) * p.width,
    pt.y * p.height
  );
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

        if ( pt ) {
          out.push( _normToCanvas(
            pt,
            flip,
            p
          ) );
        }
      } );
    }

    if ( lm.palm ) {
      const pt = hand[ HAND_PALM_INDEX ];

      if ( pt ) {
        out.push( _normToCanvas(
          pt,
          flip,
          p
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

      if ( !pt || ( pt.visibility ?? 1 ) < minConf ) {
        return;
      }

      out.push( _normToCanvas(
        pt,
        flip,
        p
      ) );
    } );
  } );
}

// One ordered group per detected hand: palm (if enabled) then the fingertips in
// thumb→pinky order, so the group strokes as a single fan across the hand.
function _collectHandGroups(
  opts, p, groups
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
  ).forEach( (
    hand, handIndex
  ) => {
    const points = [];

    if ( lm.palm ) {
      const pt = hand[ HAND_PALM_INDEX ];

      if ( pt ) {
        points.push( _normToCanvas(
          pt,
          flip,
          p
        ) );
      }
    }

    if ( lm.fingertips !== false ) {
      HAND_FINGERTIP_INDICES.forEach( ( i ) => {
        const pt = hand[ i ];

        if ( pt ) {
          points.push( _normToCanvas(
            pt,
            flip,
            p
          ) );
        }
      } );
    }

    if ( points.length > 0 ) {
      groups.push( {
        source: "hands",
        id: `hand-${ handIndex }`,
        points
      } );
    }
  } );
}

// One ordered group per detected pose, walking BODY_CHAIN and keeping only the
// landmark groups the caller enabled (and points above the confidence floor).
function _collectBodyGroups(
  opts, p, groups
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

  const enabledGroups = {
    wrists: lm.wrists !== false,
    elbows: !!lm.elbows,
    shoulders: !!lm.shoulders,
    hips: !!lm.hips
  };

  results.slice(
    0,
    maxPoses
  ).forEach( (
    pose, poseIndex
  ) => {
    const points = [];

    BODY_CHAIN.forEach( ( i ) => {
      if ( !enabledGroups[ BODY_CHAIN_GROUP[ i ] ] ) {
        return;
      }

      const pt = pose[ i ];

      if ( !pt || ( pt.visibility ?? 1 ) < minConf ) {
        return;
      }

      points.push( _normToCanvas(
        pt,
        flip,
        p
      ) );
    } );

    if ( points.length > 0 ) {
      groups.push( {
        source: "body",
        id: `pose-${ poseIndex }`,
        points
      } );
    }
  } );
}

// One ordered group per detected face, built from BlazeFace's 6 keypoints
// (eyes, nose, mouth, ears). Falls back to the bounding-box centre if a detector
// variant returns no keypoints, so a face always yields at least one point.
function _collectFaceGroups(
  opts, p, groups
) {
  const vision = opts.vision;
  const face = vision?.face;

  if ( vision?.enabled === false || !face?.enabled ) {
    return;
  }

  const flip = vision?.camera?.flip ?? true;
  const maxFaces = face.maxFaces ?? 1;
  const minConf = face.confidence ?? 0.5;
  const detections = mediapipe.tasks?.faces?.result?.detections ?? [];

  detections.slice(
    0,
    maxFaces
  ).forEach( (
    det, faceIndex
  ) => {
    if ( ( det.categories?.[ 0 ]?.score ?? 1 ) < minConf ) {
      return;
    }

    const keypoints = det.keypoints ?? [];
    const points = [];

    FACE_KEYPOINT_ORDER.forEach( ( i ) => {
      const kp = keypoints[ i ];

      if ( kp ) {
        points.push( _normToCanvas(
          kp,
          flip,
          p
        ) );
      }
    } );

    // Fallback: a single point at the bounding-box centre (pixel-space bbox).
    if ( points.length === 0 && det.boundingBox ) {
      const capW = mediapipe.capture?.size?.width ?? 320;
      const capH = mediapipe.capture?.size?.height ?? 240;
      const cx = ( det.boundingBox.originX + det.boundingBox.width / 2 ) / capW;
      const cy = ( det.boundingBox.originY + det.boundingBox.height / 2 ) / capH;

      points.push( p.createVector(
        ( flip ? 1 - cx : cx ) * p.width,
        cy * p.height
      ) );
    }

    if ( points.length > 0 ) {
      groups.push( {
        source: "face",
        id: `face-${ faceIndex }`,
        points
      } );
    }
  } );
}

// Temporal smoothing per group/point (lerp toward the new position). `amount` is
// 0..1 where 0 disables it and higher values lag more (calmer, less responsive).
function _smoothGroups(
  groups, amount
) {
  if ( !( amount > 0 ) ) {
    return groups;
  }

  const p = getP5();
  const seen = new Set();

  groups.forEach( ( group ) => {
    group.points = group.points.map( (
      v, index
    ) => {
      const key = `${ group.id }:${ index }`;

      seen.add( key );

      const prev = _groupSmoothing.get( key );

      if ( !prev ) {
        _groupSmoothing.set(
          key,
          {
            x: v.x,
            y: v.y
          }
        );

        return v;
      }

      prev.x = p.lerp(
        prev.x,
        v.x,
        1 - amount
      );
      prev.y = p.lerp(
        prev.y,
        v.y,
        1 - amount
      );

      return p.createVector(
        prev.x,
        prev.y
      );
    } );
  } );

  // Drop state for points that vanished (e.g. a hand left the frame) so they
  // don't snap from a stale position when they reappear.
  for ( const key of _groupSmoothing.keys() ) {
    if ( !seen.has( key ) ) {
      _groupSmoothing.delete( key );
    }
  }

  return groups;
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

  for ( const [
    note,
    velocity
  ] of _midiNotes ) {
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
