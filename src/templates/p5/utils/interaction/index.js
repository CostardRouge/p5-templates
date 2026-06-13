import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import options from "@/p5/utils/options.js";
import mediapipe, {
  init as mediapipeInit,
  setEnabled as setMediapipeEnabled,
  dispose as disposeMediapipe,
  getTaskResult,
  isWarmedUp as isVisionWarmedUp
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  createVideoSync
} from "@/lib/assets/kinds/videos/createVideoSync";
import {
  defaultVideoParams
} from "@/lib/assets/kinds/videos/types";
import {
  resolveAssetURL
} from "@/lib/assets/resolveAssetURL";

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

// Per-finger joint chains (base → tip), as traced in the hand-capture series
// (hand-tracking v0..v4 via drawHands.js). The thumb is "extended": it is
// rooted at the wrist so its stroke sweeps across the palm like in those
// sketches instead of floating from the thumb base.
export const HAND_FINGER_NAMES = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky"
];
export const HAND_FINGER_JOINT_INDICES = {
  thumb: [
    0,
    1,
    2,
    3,
    4
  ],
  index: [
    5,
    6,
    7,
    8
  ],
  middle: [
    9,
    10,
    11,
    12
  ],
  ring: [
    13,
    14,
    15,
    16
  ],
  pinky: [
    17,
    18,
    19,
    20
  ]
};

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
// Frame guards for collectors that mutate global state. Without them, every
// extra call inside the same frame (e.g. the debug overlay running
// getPointersDebug for the legend AND for the crosshairs AND for the pointer
// markers, plus the main sketch calling getPointerGroups) would advance the
// state again — so Perlin noise visibly accelerated when the visualization was
// enabled, and mouse smoothing converged faster too. Tracking the last frame
// that updated each piece of state keeps the rate independent of how many
// times the collector runs per frame.
let _noiseFrame = -1;
const _smoothedMouse = {
  x: 0,
  y: 0
};
let _smoothedMouseFrame = -1;
const _gyro = {
  beta: 0,
  gamma: 0
};

// Listeners
let _gyroInitialized = false;
let _gyroListener = null;
let _gyroPermissionListener = null;
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

// Warm-up gate state. `_lastVisionOpts` is the most recent interaction options
// seen by _ensureVision, so the no-arg readiness helpers (consumed by the
// clock hold and the capture hook) know which tasks to wait for. The deadline
// is a safety valve: if a camera is denied or a model fails, warm-up never
// completes, so the gate gives up after this long and lets the sketch run.
let _lastVisionOpts = null;
let _visionWarmupDeadline = 0;
const VISION_WARMUP_TIMEOUT_MS = 8000;

// Vision source media state (vision.source mode "video" / "image"): the video
// sync pool that loads/seeks the selected video asset, and the image element
// inference runs on. Owned here — mediapipe only borrows the elements.
let _visionVideoSync = null;
let _visionVideoKey = "";
let _visionVideoInstances = [];
let _visionImage = {
  path: "",
  element: null
};

// Vision results older than this read as "nothing detected", so a stalled
// pipeline never leaves a frozen hand/face on screen.
const VISION_RESULT_TTL_MS = 1500;

// Temporal smoothing state for getPointerGroups, keyed by `${groupId}:${index}`.
const _groupSmoothing = new Map();

// ── Coordinate conversion ──────────────────────────────────────────────────

// querySelector + getBoundingClientRect can force a layout pass, so the rect
// is resolved at most once per frame and shared by every mouse/touch pointer.
const _canvasRectCache = {
  frame: -1,
  canvas: null,
  rect: null
};

function _getCanvasRect( p ) {
  if ( _canvasRectCache.frame === p.frameCount && _canvasRectCache.rect ) {
    return _canvasRectCache.rect;
  }

  if ( typeof document === "undefined" ) {
    return null;
  }

  let canvas = _canvasRectCache.canvas;

  if ( !canvas || !canvas.isConnected ) {
    canvas = document.querySelector( "canvas.p5Canvas" );
    _canvasRectCache.canvas = canvas;
  }

  if ( !canvas ) {
    return null;
  }

  _canvasRectCache.frame = p.frameCount;
  _canvasRectCache.rect = canvas.getBoundingClientRect();

  return _canvasRectCache.rect;
}

/**
 * Convert viewport-space clientX/clientY to p5 canvas-space coordinates.
 * Uses getBoundingClientRect() so it correctly accounts for any CSS transforms
 * (e.g. the ScalableViewport's translate/scale) applied to the canvas's ancestors.
 */
function _clientToCanvas(
  clientX, clientY, p
) {
  const rect = _getCanvasRect( p );

  if ( !rect || rect.width === 0 || rect.height === 0 ) {
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

// ── Gyroscope helpers ──────────────────────────────────────────────────────

function _wireGyroListener() {
  _gyroListener = ( e ) => {
    _gyro.beta = e.beta ?? 0;
    _gyro.gamma = e.gamma ?? 0;
  };
  window.addEventListener(
    "deviceorientation",
    _gyroListener
  );
}

function _removeGyroPermissionListener() {
  if ( !_gyroPermissionListener ) {
    return;
  }

  window.removeEventListener(
    "click",
    _gyroPermissionListener
  );
  window.removeEventListener(
    "touchend",
    _gyroPermissionListener
  );
  _gyroPermissionListener = null;
}

// Lazily wire the deviceorientation listener the first time the gyroscope
// collector runs. The listener used to be wired only from initInteraction()
// when gyroscope.enabled was already true at setup, so toggling it on at
// runtime never attached anything and the pointer stayed glued to the canvas
// centre (beta/gamma stuck at 0). iOS 13+ additionally gates the events behind
// DeviceOrientationEvent.requestPermission(), which must be called from a user
// gesture — so there we arm a one-shot tap/click handler that requests it.
function _initGyro() {
  if ( _gyroInitialized || typeof window === "undefined" ) {
    return;
  }

  _gyroInitialized = true;

  const OrientationEvent = window.DeviceOrientationEvent;

  if ( OrientationEvent && typeof OrientationEvent.requestPermission === "function" ) {
    const requestOnGesture = () => {
      _removeGyroPermissionListener();
      OrientationEvent.requestPermission()
        .then( ( state ) => {
          if ( state === "granted" ) {
            _wireGyroListener();
          }
        } )
        .catch( () => {
          // Permission denied — leave beta/gamma at 0
        } );
    };

    _gyroPermissionListener = requestOnGesture;
    window.addEventListener(
      "click",
      requestOnGesture
    );
    window.addEventListener(
      "touchend",
      requestOnGesture
    );
  } else {
    _wireGyroListener();
  }
}

function _disposeGyro() {
  if ( typeof window === "undefined" ) {
    return;
  }

  _removeGyroPermissionListener();

  if ( _gyroListener ) {
    window.removeEventListener(
      "deviceorientation",
      _gyroListener
    );
    _gyroListener = null;
  }

  _gyroInitialized = false;
  _gyro.beta = 0;
  _gyro.gamma = 0;
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
  _noiseFrame = -1;
  _smoothedMouseFrame = -1;

  // ── Gyroscope reset (lazy init triggered by _collectGyroscope) ───────────
  _disposeGyro();

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

  // ── Vision warm-up gate ──────────────────────────────────────────────────
  // Publish the readiness signal so the timeline clock can freeze the animation
  // while vision warms up (hiding the first-inference jank) and so the headless
  // capture pipeline can await it before frame 0. Both are no-ops once warm.
  if ( typeof window !== "undefined" ) {
    window.__visionWarmupHold = _isVisionWarmupHolding;
    window.isInteractionVisionReady = () => isVisionReady();
  }

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
  _disposeGyro();

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

  // Vision / webcam / inference processor. Full dispose (not just the webcam)
  // so MediaPipe task memory and the worker don't leak across sketch switches.
  disposeMediapipe();
  _releaseVisionMedia();
  _visionSignature = "";
  _visionInitInFlight = null;
  _lastVisionOpts = null;
  _visionWarmupDeadline = 0;

  // Stop holding the next sketch's clock on this sketch's warm-up state.
  delete window.__visionWarmupHold;
  delete window.isInteractionVisionReady;

  _groupSmoothing.clear();
  _canvasRectCache.frame = -1;
  _canvasRectCache.canvas = null;
  _canvasRectCache.rect = null;
}

// Ordered registry of flat collectors. getPointers() and getPointersDebug()
// both iterate it, so adding a source means adding exactly one entry here.
const _FLAT_COLLECTORS = [
  [
    "mouse",
    _collectMouse
  ],
  [
    "touch",
    _collectTouch
  ],
  [
    "hands",
    _collectHands
  ],
  [
    "fingers",
    _collectFingers
  ],
  [
    "face",
    _collectFace
  ],
  [
    "body",
    _collectBody
  ],
  [
    "orbit",
    _collectOrbit
  ],
  [
    "perlinNoise",
    _collectPerlinNoise
  ],
  [
    "gyroscope",
    _collectGyroscope
  ],
  [
    "midi",
    _collectMidi
  ],
  [
    "audio",
    _collectAudio
  ],
  [
    "joypad",
    _collectJoypad
  ]
];

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

  _ensureVision( opts );

  const vectors = [];

  for ( const [
    ,
    collect
  ] of _FLAT_COLLECTORS ) {
    collect(
      opts,
      p,
      vectors
    );
  }

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

  _ensureVision( opts );

  const tagged = [];

  for ( const [
    source,
    collect
  ] of _FLAT_COLLECTORS ) {
    const points = [];

    collect(
      opts,
      p,
      points
    );

    for ( const vector of points ) {
      tagged.push( {
        vector,
        source
      } );
    }
  }

  return tagged;
}

/**
 * Like getPointers() but returns ORDERED, per-entity groups instead of one flat
 * list — each group is meant to become a single continuous stroke/spline.
 *
 *   - hands  → one group per detected hand  (palm → fingertips, thumb→pinky)
 *   - fingers→ one group per detected finger (joint chain, base → fingertip)
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

  // Vision sources already split their points into per-entity groups (one hand,
  // one finger, one pose, one face). The flat sources used to bundle every
  // point they produced into a single group (one "orbit" group with N orbit
  // points, one "perlinNoise" group with N noise points, …), so downstream
  // sketches saw them as ONE moving polyline / ONE averaged trail no matter
  // how many points were visible. Splitting per-point here matches the vision
  // behaviour: 6 orbits → 6 entities → 6 trails / 6 ribbons, and the demo
  // overlay still shows 6 markers because the underlying point count never
  // changed. Single-point sources (mouse, gyroscope) come out unchanged.
  const addPerPoint = (
    source, collector
  ) => {
    const points = [];

    collector(
      opts,
      p,
      points
    );

    points.forEach( (
      point, index
    ) => {
      groups.push( {
        source,
        id: `${ source }-${ index }`,
        points: [
          point
        ]
      } );
    } );
  };

  addPerPoint(
    "mouse",
    _collectMouse
  );
  addPerPoint(
    "touch",
    _collectTouch
  );

  // Vision: one ordered group per detected entity.
  _collectHandGroups(
    opts,
    p,
    groups
  );
  _collectFingerGroups(
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

  addPerPoint(
    "orbit",
    _collectOrbit
  );
  addPerPoint(
    "perlinNoise",
    _collectPerlinNoise
  );
  addPerPoint(
    "gyroscope",
    _collectGyroscope
  );
  addPerPoint(
    "midi",
    _collectMidi
  );
  addPerPoint(
    "audio",
    _collectAudio
  );
  addPerPoint(
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

  // `offset` is the vector2d pad value; offsetX/offsetY are kept as a fallback
  // for options saved before the two sliders were merged into one pad.
  const ox = mouse.offset?.x ?? mouse.offsetX ?? 0;
  const oy = mouse.offset?.y ?? mouse.offsetY ?? 0;
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
    // Step the smoothing filter at most once per frame so its convergence rate
    // doesn't speed up when the debug overlay also reads pointers (see
    // _smoothedMouseFrame above).
    if ( _smoothedMouseFrame !== p.frameCount ) {
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
      _smoothedMouseFrame = p.frameCount;
    }

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

// ── Vision source (webcam / video asset / image asset) ────────────────────
// vision.source selects what inference runs on: the webcam (with an optional
// deviceId), a video asset (driven by the sketch progression through its own
// repeat/speed/offset/loopMode params) or a still image asset. Older saved
// options only have vision.camera — that reads as webcam mode.

function _visionSourceMode( vision ) {
  return vision?.source?.mode || "webcam";
}

// Mirror handling depends on the source: webcams are mirrored by default,
// recorded videos and images are not (a right hand must stay a right hand).
function _visionFlip( vision ) {
  const mode = _visionSourceMode( vision );

  if ( mode === "video" || mode === "image" ) {
    return vision?.source?.flip ?? false;
  }

  return vision?.source?.flip ?? vision?.camera?.flip ?? true;
}

// The videos field stores serialized AssetInstances but tolerates bare path
// strings — normalize to full instances for the video sync pool.
function _normalizeVisionVideoInstances( raw ) {
  if ( !Array.isArray( raw ) ) {
    return [];
  }

  return raw
    .filter( ( entry ) => entry )
    .map( ( entry ) => ( typeof entry === "string"
      ? {
        id: `vision-${ entry }`,
        path: entry,
        params: {
          ...defaultVideoParams
        }
      }
      : {
        id: entry.id ?? `vision-${ entry.path }`,
        path: entry.path ?? "",
        params: {
          ...defaultVideoParams,
          ...( entry.params ?? {} )
        }
      } ) )
    .filter( ( instance ) => instance.path );
}

function _releaseVisionVideo() {
  if ( _visionVideoSync ) {
    _visionVideoSync.dispose();
    _visionVideoSync = null;
  }

  _visionVideoKey = "";
  _visionVideoInstances = [];
}

function _releaseVisionImage() {
  _visionImage = {
    path: "",
    element: null
  };
}

function _releaseVisionMedia() {
  _releaseVisionVideo();
  _releaseVisionImage();
}

// Per-frame upkeep of the vision source media. Returns the mediapipe `source`
// config (with a stable `key` for the re-init signature), or null while there
// is nothing to run inference on yet (e.g. video mode with no video picked).
function _ensureVisionSourceMedia( opts ) {
  const vision = opts.vision ?? {};
  const src = vision.source ?? {};
  const mode = _visionSourceMode( vision );

  if ( mode === "video" ) {
    _releaseVisionImage();

    const instances = _normalizeVisionVideoInstances( src.videos );
    const key = JSON.stringify( instances );

    _visionVideoInstances = instances;

    if ( !instances.length ) {
      _releaseVisionVideo();

      return null;
    }

    if ( !_visionVideoSync ) {
      _visionVideoSync = createVideoSync( {
        getInstances: () => _visionVideoInstances,
        jobId: () => options.id
      } );
      _visionVideoKey = key;
    } else if ( key !== _visionVideoKey ) {
      _visionVideoSync.refresh();
      _visionVideoKey = key;
    }

    // Inference runs on the first video of the stack.
    const source = _visionVideoSync.sources()[ 0 ];

    if ( !source ) {
      return null;
    }

    // Live preview: let the video play at its natural rate so
    // requestVideoFrameCallback delivers every decoded frame to MediaPipe.
    // Per-frame seekToProgression would constantly reset currentTime — the
    // frame stream would never advance, only the seeked-to frame would
    // reach inference, and the video would stutter in every preview. The
    // playback params we can honour cheaply (speed, loop) are mirrored to
    // the element; the full repeat/offset/loopMode time-stretch curve is
    // reserved for the recording pipeline, which frame-steps the video
    // deterministically.
    const element = source.element;

    if ( element ) {
      const speed = Number( source.params?.speed ) || 1;
      // Clamp to the range every browser supports.
      const rate = Math.min(
        16,
        Math.max(
          0.0625,
          speed
        )
      );

      if ( element.playbackRate !== rate ) {
        element.playbackRate = rate;
      }

      // "clamp" stops at the end, everything else loops in live preview
      // (ping-pong reverse playback isn't supported natively).
      const shouldLoop = ( source.params?.loopMode ?? "loop" ) !== "clamp";

      if ( element.loop !== shouldLoop ) {
        element.loop = shouldLoop;
      }

      if ( element.paused && element.readyState >= 2 ) {
        element.play().catch( () => {} );
      }
    }

    return {
      type: "video",
      element,
      // The instance id is part of the key: removing a video and re-adding
      // the same file swaps the element, so mediapipe must re-adopt it.
      key: `video:${ instances[ 0 ].id }:${ source.path }`
    };
  }

  if ( mode === "image" ) {
    _releaseVisionVideo();

    const raw = Array.isArray( src.image ) ? src.image[ 0 ] : src.image;
    const path = typeof raw === "string" ? raw : raw?.path ?? "";

    if ( !path ) {
      _releaseVisionImage();

      return null;
    }

    if ( _visionImage.path !== path ) {
      const element = document.createElement( "img" );

      element.crossOrigin = "anonymous";
      element.src = resolveAssetURL(
        path,
        options.id
      );
      _visionImage = {
        path,
        element
      };
    }

    return {
      type: "image",
      element: _visionImage.element,
      key: `image:${ path }`
    };
  }

  // Webcam (default), incl. legacy options without a vision.source block.
  _releaseVisionMedia();

  return {
    type: "webcam",
    deviceId: src.deviceId || "",
    key: `webcam:${ src.deviceId || "" }`
  };
}

// The MediaPipe task names wanted by the current options.
function _desiredVisionTasks( opts ) {
  const vision = opts.vision;

  if ( !vision || vision.enabled === false ) {
    return [];
  }

  const tasks = [];

  if ( vision.hands?.enabled || vision.fingers?.enabled ) {
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

// The full mediapipe init config for the current options: source, trackers,
// per-task model options and scheduling knobs.
function _visionConfigFor(
  opts, tasks, source
) {
  const vision = opts.vision ?? {};
  const cam = vision.camera ?? {};
  const src = vision.source ?? {};
  const perf = vision.performance ?? {};

  return {
    // The worker keeps inference off the draw loop entirely; mediapipe falls
    // back to main-thread inference automatically when it can't start.
    worker: perf.useWorker ?? true,
    tasks,
    source,
    captureSize: {
      width: src.width ?? cam.width ?? 320,
      height: src.height ?? cam.height ?? 240
    },
    captureFlip: _visionFlip( vision ),
    inferenceInterval: perf.inferenceInterval ?? 20,
    idleInterval: perf.idleInterval ?? 280,
    idleAfter: perf.idleAfter ?? 3000,
    taskOptions: {
      hands: {
        // One HandLandmarker serves both the hands and fingers trackers, so
        // it must detect enough hands for whichever asks for more.
        numHands: Math.max(
          vision.hands?.maxHands ?? 2,
          vision.fingers?.maxHands ?? 2
        ),
        minConfidence: vision.hands?.confidence ?? 0.5
      },
      poses: {
        numPoses: vision.body?.maxPoses ?? 1,
        model: vision.body?.model ?? "lite"
      },
      faces: {
        minConfidence: vision.face?.confidence ?? 0.5
      }
    }
  };
}

// A stable key for the parts of the configuration that require re-initializing
// MediaPipe when they change. Scheduling knobs are applied live and left out.
function _visionSignatureFor( config ) {
  return JSON.stringify( [
    config.worker,
    config.tasks,
    config.captureSize,
    config.captureFlip,
    config.taskOptions,
    // Only the stable key — the source element itself can't be stringified.
    config.source?.key ?? ""
  ] );
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
  // Remember the live options so the no-arg readiness helpers (clock hold,
  // capture hook) know which tasks the warm-up gate is waiting on.
  _lastVisionOpts = opts;

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

    _releaseVisionMedia();

    return Promise.resolve();
  }

  // Per-frame upkeep of the source media (video seek, asset changes). Null
  // means the selected source has nothing to infer on yet (no asset picked).
  const source = _ensureVisionSourceMedia( opts );

  if ( !source ) {
    if ( _visionSignature !== "" ) {
      setMediapipeEnabled( false );
      _visionSignature = "";
    }

    return Promise.resolve();
  }

  const config = _visionConfigFor(
    opts,
    tasks,
    source
  );
  const signature = _visionSignatureFor( config );

  // Already live for this exact configuration → keep it enabled (idempotent).
  if ( signature === _visionSignature && mediapipe.processor.ready ) {
    setMediapipeEnabled( true );

    // Scheduling knobs apply live — no re-init needed when a slider moves.
    mediapipe.inferenceIntervalMilliseconds = config.inferenceInterval;
    mediapipe.scheduler.idleIntervalMilliseconds = config.idleInterval;
    mediapipe.scheduler.idleAfterMilliseconds = config.idleAfter;

    return Promise.resolve();
  }

  // (Re)initialize. Release any previous webcam first so switching task sets
  // (e.g. hands → hands + body) doesn't leak the old <video> element.
  if ( mediapipe.capture.element ) {
    setMediapipeEnabled( false );
  }

  _visionSignature = signature;

  // Arm the warm-up safety deadline from the moment a (re)init starts.
  _visionWarmupDeadline = ( typeof performance !== "undefined"
    ? performance.now()
    : Date.now() ) + VISION_WARMUP_TIMEOUT_MS;

  _visionInitInFlight = mediapipeInit( config )
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

/**
 * Whether the vision pipeline for the given options has warmed up enough to
 * start the visible timeline / a recording: true when vision isn't needed,
 * when every requested task has produced its first result, or when the warm-up
 * safety deadline has passed (so a denied camera never blocks forever).
 *
 * Defaults to the last options _ensureVision saw, so the clock hold and the
 * `window.isInteractionVisionReady` capture hook can call it with no args.
 */
export function isVisionReady( opts = _lastVisionOpts ) {
  if ( !opts || opts.enabled === false ) {
    return true;
  }

  if ( _desiredVisionTasks( opts ).length === 0 ) {
    return true;
  }

  if ( isVisionWarmedUp() ) {
    return true;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  return _visionWarmupDeadline > 0 && now > _visionWarmupDeadline;
}

// Predicate published on window so the timeline clock (time.js) can freeze the
// animation while vision warms up — without time.js importing this heavy
// module. Returns true only while a hold is warranted.
function _isVisionWarmupHolding() {
  return _lastVisionOpts != null && !isVisionReady( _lastVisionOpts );
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

  const flip = _visionFlip( vision );
  const lm = hands.landmarks ?? {};
  const maxHands = hands.maxHands ?? 2;
  const results = getTaskResult(
    "hands",
    VISION_RESULT_TTL_MS
  )?.landmarks ?? [];

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

// Iterate every enabled finger of every detected hand, invoking
// cb( points, handIndex, fingerName ) with the finger's joint chain converted
// to canvas space (base → tip). Shared by the flat and grouped finger collectors.
function _eachDetectedFinger(
  opts, p, cb
) {
  const vision = opts.vision;
  const fingers = vision?.fingers;

  if ( vision?.enabled === false || !fingers?.enabled ) {
    return;
  }

  const flip = _visionFlip( vision );
  const maxHands = fingers.maxHands ?? 2;
  const results = getTaskResult(
    "hands",
    VISION_RESULT_TTL_MS
  )?.landmarks ?? [];

  results.slice(
    0,
    maxHands
  ).forEach( (
    hand, handIndex
  ) => {
    HAND_FINGER_NAMES.forEach( ( fingerName ) => {
      if ( fingers[ fingerName ] === false ) {
        return;
      }

      const points = [];

      HAND_FINGER_JOINT_INDICES[ fingerName ].forEach( ( i ) => {
        const pt = hand[ i ];

        if ( pt ) {
          points.push( _normToCanvas(
            pt,
            flip,
            p
          ) );
        }
      } );

      if ( points.length > 0 ) {
        cb(
          points,
          handIndex,
          fingerName
        );
      }
    } );
  } );
}

function _collectFingers(
  opts, p, out
) {
  _eachDetectedFinger(
    opts,
    p,
    ( points ) => {
      out.push( ...points );
    }
  );
}

// One ordered group per detected finger (per hand), so each finger strokes as
// its own continuous line — like the per-finger neon traces of the
// hand-capture series.
function _collectFingerGroups(
  opts, p, groups
) {
  _eachDetectedFinger(
    opts,
    p,
    (
      points, handIndex, fingerName
    ) => {
      groups.push( {
        source: "fingers",
        id: `hand-${ handIndex }-${ fingerName }`,
        points
      } );
    }
  );
}

function _collectFace(
  opts, p, out
) {
  const vision = opts.vision;
  const face = vision?.face;

  if ( vision?.enabled === false || !face?.enabled ) {
    return;
  }

  const flip = _visionFlip( vision );
  const detections = getTaskResult(
    "faces",
    VISION_RESULT_TTL_MS
  )?.detections ?? [];
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

  const flip = _visionFlip( vision );
  const lm = body.landmarks ?? {};
  const maxPoses = body.maxPoses ?? 1;
  const minConf = body.confidence ?? 0.3;
  const results = getTaskResult(
    "poses",
    VISION_RESULT_TTL_MS
  )?.landmarks ?? [];

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

  const flip = _visionFlip( vision );
  const lm = hands.landmarks ?? {};
  const maxHands = hands.maxHands ?? 2;
  const results = getTaskResult(
    "hands",
    VISION_RESULT_TTL_MS
  )?.landmarks ?? [];

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

  const flip = _visionFlip( vision );
  const lm = body.landmarks ?? {};
  const maxPoses = body.maxPoses ?? 1;
  const minConf = body.confidence ?? 0.3;
  const results = getTaskResult(
    "poses",
    VISION_RESULT_TTL_MS
  )?.landmarks ?? [];

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

  const flip = _visionFlip( vision );
  const maxFaces = face.maxFaces ?? 1;
  const minConf = face.confidence ?? 0.5;
  const detections = getTaskResult(
    "faces",
    VISION_RESULT_TTL_MS
  )?.detections ?? [];

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

  // Advance the noise offset at most once per frame so the scroll rate stays
  // independent of how many times this collector runs (see _noiseFrame above).
  if ( _noiseFrame !== p.frameCount ) {
    _noiseOffset += speed;
    _noiseFrame = p.frameCount;
  }

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

  // Trigger lazy listener wiring on first call (see _initGyro)
  if ( !_gyroInitialized ) {
    _initGyro();
  }

  const clamp = gyro.clampAngle ?? 45;
  const ox = gyro.offset?.x ?? 0;
  const oy = gyro.offset?.y ?? 0;

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
    ) + ox,
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
    ) + oy
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
