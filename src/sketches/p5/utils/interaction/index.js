import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import options from "@/p5/utils/options.js";
import {
  detectKick,
  detectOnset,
  detectPitch,
  detectVoice,
  getNamedBands,
  instrumentHeuristics,
  spectralFeatures
} from "@/p5/utils/interaction/audio.js";
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
  computeInteractionMetrics
} from "@/p5/utils/interaction/gestures.js";
import {
  createVideoSync
} from "@/lib/assets/kinds/videos/createVideoSync";
import {
  defaultVideoParams
} from "@/lib/assets/kinds/videos/types";
import {
  resolveAssetURL
} from "@/lib/assets/resolveAssetURL";
import {
  getPadLeds
} from "@/lib/padLedBridge";
import {
  padNoteFor, portRequiresArming
} from "@/p5/utils/interaction/controllerMap.js";
import {
  desiredPadLeds, padLedDiff, padLedsOff
} from "@/p5/utils/interaction/padLeds.js";
import {
  ensurePointerTracking,
  removePointerTracking,
  getRawMouse,
  getRawTouches
} from "@/p5/utils/interaction/pointerTracking.js";
import {
  freshGyroState,
  normalizeGyroOptions,
  recalibrate as recalibrateGyroState,
  stepGyroscope,
  toCanvas as gyroToCanvas
} from "@/p5/utils/interaction/gyroMath.js";

// Re-exported so existing consumers keep one import site; the implementation
// lives in pointerTracking.js (kept MediaPipe-free so lightweight layers can
// import it without loading this module).
export {
  ensurePointerTracking,
  clientToCanvas,
  getBasicPointerGroups
} from "@/p5/utils/interaction/pointerTracking.js";

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

// FaceLandmarker (the "faceMesh" tracker) returns 468 dense mesh landmarks per
// face. Index 1 sits on the nose bridge — a stable centre used as the single
// representative pointer for the flat collector.
const FACE_MESH_CENTER_INDEX = 1;

// ── Module-level state ─────────────────────────────────────────────────────

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
// Gyroscope state. The listeners only STORE what the sensors report; the
// per-frame maths (modes, calibration, inversion, smoothing) is the pure
// state machine in gyroMath.js, driven from _collectGyroscope.
const _gyro = {
  // off | unsupported | awaiting-gesture | denied | listening | active
  state: "off",
  // Latest orientation angles, null until a real reading arrives — desktop
  // Chrome fires ONE deviceorientation event with null angles on load, and
  // that must not read as "the phone is flat".
  orientation: null,
  // A devicemotion event carried acceleration or rotation data at least once
  // (the acceleration / rotation modes need those, orientation alone won't do).
  motion: false,
  // Peak linear acceleration since the frame that last consumed it: motion
  // events arrive at ~60 Hz and a slow sketch would otherwise miss the spike.
  accelPeak: {
    x: 0,
    y: 0
  },
  // The peak handed to the current frame (consumed once per frameCount).
  accelFrame: null,
  peakFrame: -1,
  rotationRate: null,
  // An event with null angles was seen: the API exists but no sensor does.
  sawNull: false,
  // The last frame the collector ran on — a gap means the source was toggled
  // off and on, which re-centres on the pose the phone is held in now.
  lastFrame: -1,
  step: freshGyroState()
};

// Listeners
let _gyroInitialized = false;
let _gyroOrientationListener = null;
let _gyroMotionListener = null;
let _gyroPermissionListener = null;

// MIDI state
let _midiInitialized = false;
let _midiAccess = null;
const _midiNotes = new Map(); // noteNumber → velocity
// The LEVEL of every note the controller has sent since the last reset:
// noteNumber → velocity while held, 0 once released. Distinct from _midiNotes
// (which forgets a released note, because the spatial fold only wants what is
// down) — a pad channel must publish its falling edge, or a trigger listening
// for the next press never re-arms. Read by channels.js as `midi.note<n>`.
const _midiNoteLevels = new Map(); // noteNumber → level (0–127)
// Held control-change state: ccNumber → raw value (0–127). Kept exactly like
// _midiNotes (filled by _onMidiMessage, cleared on reset / device switch /
// dispose) and read by channels.js, which normalizes it to 0..1 scalars.
const _midiControls = new Map(); // ccNumber → value (0–127)
// The CC number that moved most recently, so one channel can act as a
// zero-config "MIDI learn" (bind it, then wiggle a knob). -1 = nothing yet.
let _midiLastControl = -1;
// The input id the layer currently listens to ("" = every input). Tracked so a
// runtime change of the picker re-wires the message handlers without a reload.
let _midiDeviceId = "";
// The NAME of that input, which is what a known-controller map is keyed on — a
// device exposes several ports and they do not agree on which CC a knob sends,
// so the port name is the identity that matters. Empty while listening to every
// input: with two ports open there is no single name to answer, and a map
// applied to the wrong one would silently address the wrong knob.
let _midiDeviceName = "";
// The OUTPUT port paired with that input — same name on a Launchkey — through
// which the pads are lit and the DAW port is armed. Null while listening to
// every input: no single port to arm, and the pads of the wrong one would
// light. Everything below it is what this layer owes the hardware on the way
// out: a DAW port left armed after the tab closes keeps the keyboard in DAW
// mode until it is power-cycled, and a pad left lit stays lit.
let _midiOutput = null;
let _midiArmed = false;
// note → { color, channel } as last sent, so a frame that changes nothing
// sends nothing (see padLeds.js), and a teardown knows what to switch off.
let _ledSent = {};
// The wish list identity and port the last flush resolved against.
let _ledSeen = null;
let _ledPort = "";

// Audio state
let _audioInitialized = false;
let _audioContext = null;
let _audioAnalyser = null;
let _audioFreqData = null;
let _audioTimeData = null;
// The live microphone MediaStream, kept so its tracks can be explicitly
// stopped — closing the AudioContext alone doesn't release the mic, so the
// browser microphone indicator stays on and the input engine keeps running.
let _audioStream = null;
// The microphone deviceId the live AudioContext was opened with ("" = default).
// Tracked so changing the picker reopens the mic on the newly selected device.
let _audioDeviceId = "";
const _audioFeatures = {
  enabled: false,
  bands: null,
  kick: {
    hit: false,
    strength: 0,
    age: Infinity,
    energy: 0
  },
  onset: {
    hit: false,
    strength: 0,
    age: Infinity,
    flux: 0
  },
  pitch: {
    hz: 0,
    midi: 0,
    confidence: 0
  },
  voice: {
    active: false,
    confidence: 0,
    zcr: 0,
    voiceBand: 0
  },
  spectral: {
    centroid: 0,
    rolloff: 0,
    flatness: 0,
    flux: 0
  },
  instruments: {
    kick: 0,
    hat: 0,
    snare: 0,
    voice: 0,
    sustained: 0
  },
  sampleRate: 0,
  fftSize: 0
};
const _audioKickState = {};
const _audioOnsetState = {};
const _audioPitchState = {};
const _audioVoiceState = {};
const _audioSpectralState = {};

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
// Offscreen canvas the seeked video frame is blitted into each frame. MediaPipe
// infers on this canvas, never the raw <video>: a video that is paused and
// re-seeked every frame is an unreliable createImageBitmap/detectForVideo
// source (only the seeked-to frame lands, the rest read back black/stale),
// whereas a canvas drawn via drawImage is always a valid, stable frame — the
// exact pattern the videos pool uses to render seeked video reliably.
let _visionVideoCanvas = null;
let _visionVideoCtx = null;
let _visionVideoCanvasFrame = -1;
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

const GYRO_GESTURE_EVENTS = [
  "click",
  "touchend"
];

function _onDeviceOrientation( e ) {
  if ( typeof e.beta !== "number" || typeof e.gamma !== "number" ) {
    _gyro.sawNull = true;

    return;
  }

  _gyro.orientation = {
    beta: e.beta,
    gamma: e.gamma
  };
  _gyro.state = "active";
}

function _onDeviceMotion( e ) {
  const acceleration = e.acceleration;

  if ( acceleration && typeof acceleration.x === "number" && typeof acceleration.y === "number" ) {
    _gyro.motion = true;
    _gyro.state = "active";

    if ( Math.abs( acceleration.x ) > Math.abs( _gyro.accelPeak.x ) ) {
      _gyro.accelPeak.x = acceleration.x;
    }

    if ( Math.abs( acceleration.y ) > Math.abs( _gyro.accelPeak.y ) ) {
      _gyro.accelPeak.y = acceleration.y;
    }
  }

  const rate = e.rotationRate;

  if ( rate && typeof rate.beta === "number" && typeof rate.gamma === "number" ) {
    _gyro.motion = true;
    _gyro.state = "active";
    _gyro.rotationRate = {
      beta: rate.beta,
      gamma: rate.gamma
    };
  }
}

function _wireGyroListeners() {
  if ( _gyroOrientationListener ) {
    return;
  }

  _gyroOrientationListener = _onDeviceOrientation;
  _gyroMotionListener = _onDeviceMotion;
  window.addEventListener(
    "deviceorientation",
    _gyroOrientationListener
  );
  window.addEventListener(
    "devicemotion",
    _gyroMotionListener
  );
  _gyro.state = "listening";
}

function _removeGyroPermissionListener() {
  if ( !_gyroPermissionListener ) {
    return;
  }

  for ( const type of GYRO_GESTURE_EVENTS ) {
    window.removeEventListener(
      type,
      _gyroPermissionListener,
      {
        capture: true
      }
    );
  }

  _gyroPermissionListener = null;
}

// iOS 13+ gates BOTH event families behind a static requestPermission() —
// one prompt covers orientation and motion, but each constructor has to be
// asked, and the calls must be made synchronously inside the user gesture.
// Resolves true when at least one of them is granted.
function _requestGyroPermissions() {
  const requests = [];

  for ( const Ctor of [
    window.DeviceOrientationEvent,
    window.DeviceMotionEvent
  ] ) {
    if ( Ctor && typeof Ctor.requestPermission === "function" ) {
      requests.push( Ctor.requestPermission() );
    }
  }

  if ( requests.length === 0 ) {
    return Promise.resolve( {
      granted: true,
      denied: false
    } );
  }

  return Promise.allSettled( requests ).then( ( results ) => ( {
    granted: results.some( ( r ) => r.status === "fulfilled" && r.value === "granted" ),
    denied: results.some( ( r ) => r.status === "fulfilled" && r.value === "denied" )
  } ) );
}

function _armGyroPermissionGesture() {
  if ( _gyroPermissionListener ) {
    return;
  }

  const requestOnGesture = () => {
    _removeGyroPermissionListener();
    _requestGyroPermissions()
      .then( ( {
        granted
      } ) => {
        if ( granted ) {
          _wireGyroListeners();
        } else {
          _gyro.state = "denied";
        }
      } )
      .catch( () => {
        _gyro.state = "denied";
      } );
  };

  _gyroPermissionListener = requestOnGesture;
  _gyro.state = "awaiting-gesture";

  // Capture phase, so a control that stops propagation (a menu, a popover)
  // cannot swallow the one tap the permission prompt is waiting for.
  for ( const type of GYRO_GESTURE_EVENTS ) {
    window.addEventListener(
      type,
      requestOnGesture,
      {
        capture: true,
        passive: true
      }
    );
  }
}

// Lazily wire the sensor listeners the first time the gyroscope collector
// runs (or from initInteraction when the source is already on at setup, so a
// paused sketch still gets armed). iOS 13+ gates the events behind
// requestPermission(), which needs a user gesture — but resolves without one
// once granted in this page session, so it is tried first: a source switched
// off and on again then costs no extra tap. Only when that attempt rejects is
// a one-shot tap/click handler armed to ask from inside the gesture.
function _initGyro() {
  if ( _gyroInitialized || typeof window === "undefined" ) {
    return;
  }

  _gyroInitialized = true;

  const hasApi = typeof window.DeviceOrientationEvent !== "undefined" || typeof window.DeviceMotionEvent !== "undefined";

  if ( !hasApi ) {
    _gyro.state = "unsupported";

    return;
  }

  const needsPermission = [
    window.DeviceOrientationEvent,
    window.DeviceMotionEvent
  ].some( ( Ctor ) => Ctor && typeof Ctor.requestPermission === "function" );

  if ( !needsPermission ) {
    _wireGyroListeners();

    return;
  }

  _gyro.state = "awaiting-gesture";
  _requestGyroPermissions()
    .then( ( {
      granted, denied
    } ) => {
      if ( granted ) {
        _wireGyroListeners();
      } else if ( denied ) {
        _gyro.state = "denied";
      } else {
        _armGyroPermissionGesture();
      }
    } )
    .catch( () => {
      _armGyroPermissionGesture();
    } );
}

function _disposeGyro() {
  if ( typeof window === "undefined" ) {
    return;
  }

  _removeGyroPermissionListener();

  if ( _gyroOrientationListener ) {
    window.removeEventListener(
      "deviceorientation",
      _gyroOrientationListener
    );
    _gyroOrientationListener = null;
  }

  if ( _gyroMotionListener ) {
    window.removeEventListener(
      "devicemotion",
      _gyroMotionListener
    );
    _gyroMotionListener = null;
  }

  _gyroInitialized = false;
  _gyro.state = "off";
  _gyro.orientation = null;
  _gyro.motion = false;
  _gyro.accelPeak.x = 0;
  _gyro.accelPeak.y = 0;
  _gyro.accelFrame = null;
  _gyro.peakFrame = -1;
  _gyro.rotationRate = null;
  _gyro.sawNull = false;
  _gyro.lastFrame = -1;
  _gyro.step = freshGyroState();
}

function _readScreenAngle() {
  const angle = window.screen?.orientation?.angle;

  if ( typeof angle === "number" ) {
    return angle;
  }

  // Legacy iOS: -90 / 0 / 90 / 180.
  const legacy = window.orientation;

  return typeof legacy === "number" ? legacy : 0;
}

// ── MIDI helpers ───────────────────────────────────────────────────────────

function _wireMidiInputs() {
  if ( !_midiAccess ) {
    return;
  }

  // With no device picked ("") listen to every input; otherwise only the
  // selected one fires, so the other controllers are ignored.
  _midiDeviceName = "";

  _midiAccess.inputs.forEach( ( input ) => {
    const listening = !_midiDeviceId || input.id === _midiDeviceId;

    input.onmidimessage = listening ? _onMidiMessage : null;

    // Only a specific pick yields a name: this is the one place that sees the
    // input objects, and it re-runs on every `onstatechange`, so the name
    // follows a device being unplugged without any extra bookkeeping.
    if ( listening && _midiDeviceId ) {
      _midiDeviceName = input.name || "";
    }
  } );

  _wireMidiOutputs();
}

function _sendMidi( bytes ) {
  if ( !_midiOutput ) {
    return;
  }

  try {
    _midiOutput.send( bytes );
  } catch {
    // An output that vanished between the state change and this send.
  }
}

// Pair the output with the input by NAME, which is how a Launchkey exposes
// its ports: "… DAW Port" in, "… DAW Port" out. Re-run on every state change
// like the inputs. Arms the port when the map says it needs it — `9F 0C 7F`,
// a plain note-on on channel 16, no SysEx, so no extra permission prompt.
function _wireMidiOutputs() {
  const name = _midiDeviceName;
  let output = null;

  if ( _midiAccess && name ) {
    _midiAccess.outputs.forEach( ( candidate ) => {
      if ( !output && candidate.name === name ) {
        output = candidate;
      }
    } );
  }

  if ( output === _midiOutput ) {
    return;
  }

  // Release the previous port cleanly before adopting the new one: its pads
  // off, its DAW mode off.
  _disarmMidiOutput();
  _midiOutput = output;

  if ( output && portRequiresArming( name ) ) {
    _sendMidi( [
      0x9f,
      0x0c,
      0x7f
    ] );
    _midiArmed = true;
  }
}

// Undo everything sent to the output: every lit pad off, then `9F 0C 00` if
// the port was armed. Runs from _clearMidiState (reset, dispose, a device
// switch) and from `pagehide`, because leaving a keyboard in DAW mode after
// the tab is gone is the trap TODO.md names — the pads stay dark and the
// knobs stay silent until the user power-cycles it.
function _disarmMidiOutput() {
  if ( _midiOutput ) {
    padLedsOff( _ledSent ).forEach( _sendMidi );

    if ( _midiArmed ) {
      _sendMidi( [
        0x9f,
        0x0c,
        0x00
      ] );
    }
  }

  _midiOutput = null;
  _midiArmed = false;
  _ledSent = {};
  _ledSeen = null;
  _ledPort = "";
}

// Send the pads what the editor wants them to show, and only what changed.
// Called every frame from _collectMidi, so the wish list is compared by
// identity first (the bridge hands back the same array until a publish) and
// the diff only runs when a field changed its mind or the port moved.
function _flushPadLeds() {
  if ( !_midiOutput ) {
    return;
  }

  const entries = getPadLeds();

  if ( entries === _ledSeen && _ledPort === _midiDeviceName ) {
    return;
  }

  _ledSeen = entries;
  _ledPort = _midiDeviceName;

  const port = _midiDeviceName;
  const {
    messages, next
  } = padLedDiff(
    _ledSent,
    desiredPadLeds(
      entries,
      ( control ) => padNoteFor(
        port,
        control
      )
    )
  );

  messages.forEach( _sendMidi );
  _ledSent = next;
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
    _midiNoteLevels.set(
      note,
      velocity
    );
  } else if ( command === 0x80 || ( command === 0x90 && velocity === 0 ) ) {
    _midiNotes.delete( note );
    _midiNoteLevels.set(
      note,
      0
    );
  } else if ( command === 0xb0 ) {
    // Control change: a knob/fader position, which unlike a note is HELD —
    // there is no "off" message, so the entry stays until a reset.
    _midiControls.set(
      note,
      velocity
    );
    _midiLastControl = note;
  }
}

// Drop held MIDI state. Notes and controls are cleared together everywhere: a
// value from a device we stopped listening to is stale either way.
function _clearMidiState() {
  _disarmMidiOutput();
  _midiNotes.clear();
  _midiNoteLevels.clear();
  _midiControls.clear();
  _midiLastControl = -1;
  _midiDeviceName = "";
}

async function _initMidi( opts ) {
  if ( _midiInitialized ) {
    return;
  }

  _midiInitialized = true;
  // Seed the selected input before the first wire so it is honoured from the
  // start (the picker may already point at a specific device).
  _midiDeviceId = opts?.midi?.deviceId || "";

  if ( typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function" ) {
    return;
  }

  try {
    _midiAccess = await navigator.requestMIDIAccess();
    _wireMidiInputs();
    _midiAccess.onstatechange = () => _wireMidiInputs();
    // The one teardown React cannot run: the tab going away. `pagehide`
    // fires on close, reload and bfcache entry alike; a synchronous send
    // still goes out from it. Registered once — access is requested once.
    window.addEventListener(
      "pagehide",
      _disarmMidiOutput
    );
  } catch {
    // Permission denied or MIDI not available
  }
}

// ── Audio helpers ──────────────────────────────────────────────────────────

// Tear down the live audio graph and release the microphone. Stopping the
// MediaStream tracks is what clears the browser mic indicator and stops the
// input engine; closing the AudioContext alone leaves the mic "live".
function _closeAudio() {
  if ( _audioStream ) {
    _audioStream.getTracks().forEach( ( track ) => track.stop() );
    _audioStream = null;
  }

  if ( _audioContext ) {
    _audioContext.close().catch( () => {} );
    _audioContext = null;
    _audioAnalyser = null;
    _audioFreqData = null;
    _audioTimeData = null;
  }

  // Drop detector running averages so a re-init starts clean.
  _audioFeatures.enabled = false;
  delete _audioKickState.initialized;
  delete _audioOnsetState.initialized;
  delete _audioPitchState.initialized;
  delete _audioVoiceState.initialized;
  delete _audioSpectralState.initialized;
}

async function _initAudio( opts ) {
  const deviceId = opts.audio?.deviceId || "";

  // Already streaming from the requested microphone → nothing to do.
  if ( _audioInitialized && _audioDeviceId === deviceId ) {
    return;
  }

  // Reopening on a different device: release the previous mic + context first so
  // we don't leak it (changing the picker at runtime swaps the input).
  _closeAudio();

  // Claim the device synchronously (before awaiting) so the per-frame collector
  // doesn't kick off a second init while getUserMedia is still resolving.
  _audioInitialized = true;
  _audioDeviceId = deviceId;

  try {
    const stream = await navigator.mediaDevices.getUserMedia( {
      // A specific microphone was requested → constrain to it (mirrors the
      // webcam picker); "" lets the browser pick its default input.
      audio: deviceId
        ? {
          deviceId: {
            exact: deviceId
          }
        }
        : true,
      video: false
    } );

    // A newer init, or a dispose, superseded this one while getUserMedia was
    // resolving (dispose clears _audioInitialized; a re-init changes the device)
    // — abandon this stream so it doesn't leak or clobber the live one.
    if ( !_audioInitialized || _audioDeviceId !== deviceId ) {
      stream.getTracks().forEach( ( track ) => track.stop() );

      return;
    }

    // Hold onto the stream so its tracks can be stopped on disable/dispose.
    _audioStream = stream;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;

    _audioContext = new AudioCtx();
    _audioAnalyser = _audioContext.createAnalyser();
    _audioAnalyser.fftSize = opts.audio?.fftSize ?? 1024;
    _audioAnalyser.smoothingTimeConstant = opts.audio?.smoothing ?? 0.8;

    const source = _audioContext.createMediaStreamSource( stream );

    source.connect( _audioAnalyser );
    _audioFreqData = new Uint8Array( _audioAnalyser.frequencyBinCount );
    _audioTimeData = new Uint8Array( _audioAnalyser.fftSize );
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
  // Armed right away when the source is already on, so a sketch that sits
  // paused while the form is edited still gets its permission prompt on the
  // next tap instead of waiting for a frame that never comes.
  _disposeGyro();

  if ( opts.gyroscope?.enabled ) {
    _initGyro();
  }

  // ── Raw mouse / touch tracking ───────────────────────────────────────────
  // Raw clientX/Y is tracked (in pointerTracking.js) so _clientToCanvas() can
  // give correct canvas-space coordinates regardless of CSS transforms in
  // ScalableViewport. Re-wire from scratch so a fresh sketch starts clean.
  removePointerTracking();
  ensurePointerTracking();

  // ── MIDI reset (lazy init triggered by _collectMidi) ─────────────────────
  if ( _midiAccess ) {
    _midiAccess.inputs.forEach( ( input ) => {
      input.onmidimessage = null;
    } );
  }

  _midiAccess = null;
  _midiInitialized = false;
  _midiDeviceId = "";
  _clearMidiState();

  // ── Audio reset (lazy init triggered by _collectAudio) ───────────────────
  _closeAudio();
  _audioInitialized = false;
  _audioDeviceId = "";

  // ── Vision readiness signal ──────────────────────────────────────────────
  // Published so the headless capture pipeline can await a warmed-up vision
  // source before frame 0 (see prepareCapture). Live preview deliberately does
  // NOT block on this — the sketch animates from the start; freezing it while
  // MediaPipe warmed up read as startup stutter, so that hold was removed.
  if ( typeof window !== "undefined" ) {
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

  // Mouse + touch
  removePointerTracking();

  // MIDI
  if ( _midiAccess ) {
    _midiAccess.inputs.forEach( ( input ) => {
      input.onmidimessage = null;
    } );
    _midiAccess = null;
  }

  _midiInitialized = false;
  _midiDeviceId = "";
  _clearMidiState();

  // Audio — stop the mic tracks (not just close the context) so the browser
  // microphone indicator clears when the sketch is torn down.
  _closeAudio();
  _audioInitialized = false;
  _audioDeviceId = "";

  // Vision / webcam / inference processor. Full dispose (not just the webcam)
  // so MediaPipe task memory and the worker don't leak across sketch switches.
  disposeMediapipe();
  _releaseVisionMedia();
  _visionSignature = "";
  _visionInitInFlight = null;
  _lastVisionOpts = null;
  _visionWarmupDeadline = 0;

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
    "faceMesh",
    _collectFaceMesh
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
    _collectJoypadLeft
  ],
  [
    "joypadRight",
    _collectJoypadRight
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
 *   - orbit / perlinNoise / audio / touch / midi / mouse / gyroscope
 *            → one group holding that source's points
 *   - joypad → one group per stick (left → "joypad", right → "joypadRight")
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
  _collectFaceMeshGroups(
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
    _collectJoypadLeft
  );
  addPerPoint(
    "joypadRight",
    _collectJoypadRight
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

  // Lazily wire the raw pointer listeners, like _initGyro: the engine only
  // boots initInteraction() at setup when a source is already enabled, so a
  // mouse source toggled on at runtime must arm tracking itself (idempotent).
  ensurePointerTracking();

  // `offset` is the vector2d pad value; offsetX/offsetY are kept as a fallback
  // for options saved before the two sliders were merged into one pad.
  const ox = mouse.offset?.x ?? mouse.offsetX ?? 0;
  const oy = mouse.offset?.y ?? mouse.offsetY ?? 0;
  const smoothing = mouse.smoothing ?? 0;

  // Use raw client coordinates converted through getBoundingClientRect() so
  // the result is correct even when ScalableViewport has panned/zoomed the
  // canvas (CSS transform on the parent doesn't affect the formula).
  const rawMouse = getRawMouse();
  let rawX, rawY;

  if ( rawMouse.clientX === null ) {
    // No pointermove yet — fall back to p5's values for the first frame
    rawX = p.mouseX;
    rawY = p.mouseY;
  } else {
    const coords = _clientToCanvas(
      rawMouse.clientX,
      rawMouse.clientY,
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

  // Same runtime-toggle story as _collectMouse: without the setup boot, the
  // touch listeners must be armed from the collector (idempotent).
  ensurePointerTracking();

  const rawTouches = getRawTouches();
  const maxTouches = touch.maxTouches ?? 5;
  const count = Math.min(
    rawTouches.length,
    maxTouches
  );

  for ( let i = 0; i < count; i++ ) {
    const {
      x, y
    } = _clientToCanvas(
      rawTouches[ i ].clientX,
      rawTouches[ i ].clientY,
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
  // The detached canvas is GC'd once dereferenced.
  _visionVideoCanvas = null;
  _visionVideoCtx = null;
  _visionVideoCanvasFrame = -1;
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

// Per-frame source-media result cache. _ensureVision runs ~5× per draw frame
// (the sketch's getPointerGroups plus the debug-overlay collectors), and the
// upkeep below allocates + JSON.stringifies the video instances and reconciles
// the source every call. Compute it once per frame and reuse it for the rest.
let _visionSourceFrame = -1;
let _visionSourceCache = null;

// Per-frame upkeep of the vision source media. Returns the mediapipe `source`
// config (with a stable `key` for the re-init signature), or null while there
// is nothing to run inference on yet (e.g. video mode with no video picked).
function _ensureVisionSourceMedia( opts ) {
  const frame = getP5()?.frameCount ?? -1;

  // -1 means no p5 yet (pre-first-draw) — don't cache, just recompute.
  if ( frame !== -1 && frame === _visionSourceFrame ) {
    return _visionSourceCache;
  }

  _visionSourceFrame = frame;
  _visionSourceCache = _computeVisionSourceMedia( opts );

  return _visionSourceCache;
}

function _computeVisionSourceMedia( opts ) {
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

    // Drive the video off the sketch progression — exactly like a video drawn
    // by the videos pool — so scrubbing the timeline moves the video (and the
    // landmarks it produces) with it, honouring the asset's
    // repeat/speed/offset/loopMode params via seekToProgression.
    // seekToProgression dedupes repeat calls with the same target, so the
    // several calls per frame issue at most one seek per progression value.
    source.seekToProgression( animation.progression ).catch( () => {} );

    const video = source.element;
    const vw = video?.videoWidth ?? 0;
    const vh = video?.videoHeight ?? 0;

    // Metadata not decoded yet → nothing to infer on. The warm-up gate keeps
    // the loading mask up until the first frame is available.
    if ( !vw || !vh ) {
      return null;
    }

    if ( !_visionVideoCanvas ) {
      _visionVideoCanvas = document.createElement( "canvas" );
      _visionVideoCtx = _visionVideoCanvas.getContext( "2d" );
    }

    if ( _visionVideoCanvas.width !== vw || _visionVideoCanvas.height !== vh ) {
      _visionVideoCanvas.width = vw;
      _visionVideoCanvas.height = vh;
    }

    // Blit the video's current frame into the canvas once per draw frame (the
    // interaction layer calls this several times per frame). drawImage grabs
    // whatever the seek last settled on — forgiving where createImageBitmap on
    // the live <video> was not.
    const frame = getP5()?.frameCount ?? 0;

    if ( frame !== _visionVideoCanvasFrame && _visionVideoCtx ) {
      _visionVideoCanvasFrame = frame;

      try {
        _visionVideoCtx.drawImage(
          video,
          0,
          0,
          vw,
          vh
        );
      } catch {
        // Frame not decodable this tick — keep the previous canvas contents.
      }
    }

    return {
      type: "video",
      element: _visionVideoCanvas,
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

  if ( vision.faceMesh?.enabled ) {
    tasks.push( "faceMesh" );
  }

  // The DeepLab category mask (`mediapipe.tasks.segmenter`). Not in the shared
  // form: a sketch that wants a silhouette rather than landmarks sets
  // `vision.segmenter.enabled` on the options it hands the interaction layer
  // (sculpt-v3-vision-relief's mask mode), and reads the result itself.
  if ( vision.segmenter?.enabled ) {
    tasks.push( "segmenter" );
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
      },
      faceMesh: {
        numFaces: vision.faceMesh?.maxFaces ?? 1,
        minConfidence: vision.faceMesh?.confidence ?? 0.5,
        blendshapes: vision.faceMesh?.blendshapes ?? true
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
    // Reset the warm-up deadline so a later re-enable arms a fresh window.
    _visionWarmupDeadline = 0;

    return Promise.resolve();
  }

  // Arm the warm-up safety deadline as soon as a tracker is wanted — even
  // before a source is ready — so the clock-hold mask can never get stuck
  // (e.g. a video whose metadata never loads, a denied camera). Re-init below
  // refreshes it; this only seeds it when nothing has started the window yet.
  if ( _visionWarmupDeadline === 0 ) {
    _visionWarmupDeadline = ( typeof performance !== "undefined"
      ? performance.now()
      : Date.now() ) + VISION_WARMUP_TIMEOUT_MS;
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

function _collectFaceMesh(
  opts, p, out
) {
  const vision = opts.vision;
  const faceMesh = vision?.faceMesh;

  if ( vision?.enabled === false || !faceMesh?.enabled ) {
    return;
  }

  const flip = _visionFlip( vision );
  const faces = getTaskResult(
    "faceMesh",
    VISION_RESULT_TTL_MS
  )?.faceLandmarks ?? [];
  const maxFaces = faceMesh.maxFaces ?? 1;

  faces.slice(
    0,
    maxFaces
  ).forEach( ( landmarks ) => {
    const center = landmarks?.[ FACE_MESH_CENTER_INDEX ];

    if ( center ) {
      out.push( _normToCanvas(
        center,
        flip,
        p
      ) );
    }
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

function _collectFaceMeshGroups(
  opts, p, groups
) {
  const vision = opts.vision;
  const faceMesh = vision?.faceMesh;

  if ( vision?.enabled === false || !faceMesh?.enabled ) {
    return;
  }

  const flip = _visionFlip( vision );
  const maxFaces = faceMesh.maxFaces ?? 1;
  const faces = getTaskResult(
    "faceMesh",
    VISION_RESULT_TTL_MS
  )?.faceLandmarks ?? [];

  faces.slice(
    0,
    maxFaces
  ).forEach( (
    landmarks, faceIndex
  ) => {
    if ( !landmarks?.length ) {
      return;
    }

    // The full 468-point mesh as one group — sketches draw it as a point cloud
    // (the classic MediaPipe FaceMesh look) or index individual landmarks.
    const points = landmarks.map( ( lm ) => _normToCanvas(
      lm,
      flip,
      p
    ) );

    groups.push( {
      source: "faceMesh",
      id: `faceMesh-${ faceIndex }`,
      points
    } );
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

  const frame = p.frameCount ?? -1;

  // A gap in the frames this ran on means the source was switched off and
  // back on (a paused sketch does not advance frameCount): the pose the phone
  // is held in NOW becomes the centre again.
  if ( _gyro.lastFrame >= 0 && frame - _gyro.lastFrame > 1 ) {
    recalibrateGyroState( _gyro.step );
  }

  _gyro.lastFrame = frame;

  const options = normalizeGyroOptions( gyro );

  // Hand the acceleration peak to the frame once, then start a new one.
  if ( frame !== _gyro.peakFrame ) {
    _gyro.peakFrame = frame;
    _gyro.accelFrame = _gyro.motion
      ? {
        x: _gyro.accelPeak.x,
        y: _gyro.accelPeak.y
      }
      : null;
    _gyro.accelPeak.x = 0;
    _gyro.accelPeak.y = 0;
  }

  const unit = stepGyroscope(
    _gyro.step,
    {
      orientation: _gyro.orientation,
      acceleration: _gyro.accelFrame,
      rotationRate: _gyro.rotationRate,
      screenAngle: options.screenRotation ? _readScreenAngle() : 0
    },
    options,
    frame,
    ( p.deltaTime ?? 0 ) / 1000
  );

  // No reading yet (permission pending, no sensor, headless capture): publish
  // nothing rather than a pointer parked at the centre — see channels.js.
  if ( !unit ) {
    return;
  }

  const {
    x, y
  } = gyroToCanvas(
    unit,
    p.width,
    p.height,
    options.offset
  );

  out.push( p.createVector(
    x,
    y
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
    _initMidi( opts );

    return;
  }

  // Re-wire when the picker changes input at runtime, dropping notes and knob
  // positions still held on the previously-selected device so they don't linger.
  const desiredDevice = midi.deviceId || "";

  if ( _midiDeviceId !== desiredDevice ) {
    _midiDeviceId = desiredDevice;
    _clearMidiState();
    _wireMidiInputs();
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

  // The pads' LEDs ride the same per-frame call, so they only ever run while
  // MIDI is enabled and initialised — the one lifecycle this layer has.
  _flushPadLeds();
}

function _collectAudio(
  opts, p, out
) {
  const audio = opts.audio;

  if ( !audio?.enabled ) {
    // Toggled off in the form: release the mic right away so the browser
    // microphone indicator clears instead of lingering until dispose.
    if ( _audioInitialized ) {
      _closeAudio();
      _audioInitialized = false;
      _audioDeviceId = "";
    }

    return;
  }

  // Trigger lazy mic request on first call, and reopen the stream if the picker
  // switched to a different input device since the context was created.
  if ( !_audioInitialized || _audioDeviceId !== ( audio.deviceId || "" ) ) {
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

  _runAudioFeatures( audio );
}

function _runAudioFeatures( audio ) {
  const features = audio.features;

  if ( !features || !_audioTimeData ) {
    _audioFeatures.enabled = false;

    return;
  }

  const engine = audio.engine ?? "dsp";

  if ( engine !== "dsp" ) {
    // Reserved seam for future ML engines (yamnet / custom TF.js model).
    _audioFeatures.enabled = false;

    return;
  }

  _audioAnalyser.getByteTimeDomainData( _audioTimeData );

  const sr = _audioContext.sampleRate;
  const fft = _audioAnalyser.fftSize;

  _audioFeatures.enabled = true;
  _audioFeatures.sampleRate = sr;
  _audioFeatures.fftSize = fft;

  if ( features.bands ) {
    _audioFeatures.bands = getNamedBands(
      _audioFreqData,
      sr,
      fft,
      audio.bands
    );
  }

  if ( features.spectral ) {
    _audioFeatures.spectral = spectralFeatures(
      _audioSpectralState,
      _audioFreqData,
      sr,
      fft
    );
  }

  if ( features.kick ) {
    _audioFeatures.kick = detectKick(
      _audioKickState,
      _audioFreqData,
      sr,
      fft,
      audio.kick
    );
  }

  if ( features.onset ) {
    _audioFeatures.onset = detectOnset(
      _audioOnsetState,
      _audioFreqData,
      audio.onset
    );
  }

  if ( features.pitch ) {
    _audioFeatures.pitch = detectPitch(
      _audioPitchState,
      _audioTimeData,
      sr,
      audio.pitch
    );
  }

  if ( features.voice ) {
    _audioFeatures.voice = detectVoice(
      _audioVoiceState,
      _audioFreqData,
      _audioTimeData,
      sr,
      fft,
      audio.voice
    );
  }

  _audioFeatures.instruments = instrumentHeuristics( _audioFeatures );
}

/**
 * Snapshot of the latest audio features computed during the most recent
 * getPointers() / draw frame. Returns the same live object every call
 * (mutated in place) — safe to read fields directly.
 *
 * Fields are only populated when the corresponding entry under
 * `interaction.audio.features` is enabled in the sketch options.
 *
 * @returns {object} { enabled, bands, kick, onset, pitch, voice, spectral, instruments }
 */
export function getAudio() {
  return _audioFeatures;
}

/**
 * Where the gyroscope source stands, for the debug overlay and any UI that
 * wants to say WHY no pointer is arriving: a permission still waiting for a
 * tap (iOS), a page served over HTTP (browsers block motion events there), a
 * device with no sensor, or a mode whose sensor never reported.
 *
 * `hint` is null once readings the current mode can use are arriving.
 *
 * @param {object} [gyro] - the `interaction.gyroscope` block (for its mode)
 * @returns {{ state: string, hint: string | null, secure: boolean,
 *   orientation: { beta: number, gamma: number } | null,
 *   rotationRate: { beta: number, gamma: number } | null }}
 */
export function getGyroscopeStatus( gyro ) {
  const secure = typeof window === "undefined" ? true : window.isSecureContext !== false;
  const mode = normalizeGyroOptions( gyro ?? {} ).mode;
  const needsMotion = mode === "acceleration" || mode === "rotation";
  let hint = null;

  switch ( _gyro.state ) {
    case "unsupported":
      hint = "no motion sensor API in this browser";
      break;
    case "awaiting-gesture":
      hint = "tap the page to allow motion access";
      break;
    case "denied":
      hint = "motion access denied — reload the page to be asked again";
      break;
    case "listening":
      if ( _gyro.sawNull ) {
        hint = "no motion sensor on this device";
      } else if ( !secure ) {
        hint = "waiting for the sensor — not HTTPS, browsers block motion events here";
      } else {
        hint = "waiting for the first sensor reading…";
      }
      break;
    case "active":
      if ( needsMotion && !_gyro.motion ) {
        hint = `${ mode } needs devicemotion events, none arrived — try the tilt mode`;
      } else if ( !needsMotion && !_gyro.orientation ) {
        hint = "no orientation reading yet — try the acceleration or rotation mode";
      }
      break;
    default:
      break;
  }

  return {
    state: _gyro.state,
    hint,
    secure,
    orientation: _gyro.orientation,
    rotationRate: _gyro.rotationRate
  };
}

/**
 * Make the pose the phone is held in right now the canvas centre again (tilt
 * and gravity modes, `auto` calibration). The collector does this itself when
 * the source is toggled off and on; a sketch can offer it on a tap.
 */
export function recalibrateGyroscope() {
  recalibrateGyroState( _gyro.step );
}

/**
 * Held MIDI control-change (CC) state: the same live Map every call, keyed by
 * CC number with the raw 0–127 value the controller last sent. Only CC numbers
 * actually received since the last reset are present — an untouched knob has no
 * entry at all, which is what keeps a binding on it a no-op (see channels.js).
 *
 * Populated only while `interaction.midi.enabled` is on (the per-frame
 * collector is what requests MIDI access).
 *
 * @returns {Map<number, number>} ccNumber → value (0–127)
 */
export function getMidiControls() {
  return _midiControls;
}

/**
 * The level of every note received since the last reset: velocity while the
 * key or pad is held, 0 after release. The same live Map every call. A note
 * never sent has no entry, which is what keeps a pad binding a no-op until the
 * pad is actually hit (the CC policy, see `getMidiControls`).
 *
 * Backs the `midi.note<n>` channels — a pad is a scalar that goes 0 → v → 0,
 * and the rising edge is what a trigger listens for.
 *
 * @returns {Map<number, number>} noteNumber → level (0–127)
 */
export function getMidiNoteLevels() {
  return _midiNoteLevels;
}

/**
 * The CC number that moved most recently, or -1 when none has. Backs the
 * `midi.ccLast` channel, which is a zero-config MIDI learn: bind it, move any
 * knob, and that knob drives the parameter regardless of its CC number.
 *
 * @returns {number}
 */
export function getMidiLastControl() {
  return _midiLastControl;
}

/**
 * The NAME of the MIDI input currently listened to, or "" when none is picked.
 *
 * Empty is deliberate rather than a best guess: with `deviceId` left at "" the
 * layer listens to every port at once, and a Launchkey publishes two whose
 * knobs send different CC numbers — so there is no single name to answer, and a
 * controller map applied to the wrong one would address the wrong knob without
 * any visible error. Callers treat "" as "no known controller".
 *
 * @returns {string}
 */
export function getMidiDeviceName() {
  return _midiDeviceName;
}

/**
 * Live "gesture" snapshot derived from the vision pipeline — the semantic view
 * of what the camera sees this frame:
 *
 *   hands: { count, open, closed, openness, fingers, depth }  // all hands
 *   hand:  { present, openness, fingers, depth, pinch, spread } // closest hand
 *   face:  { count, present, depth }
 *
 * Openness/depth/pinch/spread are 0..1; counts are integers; `depth` rises as a
 * hand nears the camera (apparent size grows). Values are smoothed and cached
 * per frame. Ensures the vision pipeline is running, then delegates the math to
 * gestures.js. The binding system reads this through channels.js, which
 * normalizes it into `hands.*` / `face.*` scalar channels.
 *
 * @param {object} [opts] - the `interaction` section of sketch options
 * @returns {ReturnType<typeof computeInteractionMetrics>}
 */
export function getInteractionMetrics( opts = options.sketch?.interaction ?? {} ) {
  if ( opts && opts.enabled !== false ) {
    _ensureVision( opts );
  }

  return computeInteractionMetrics( opts );
}

// Gamepads matching `opts.joypad`, up to `count` (deviceId "" = any connected
// pad; identical controllers share an id, so several may still match). Shared
// by the left/right stick collectors so both read the same resolved pad set.
function _resolveJoypads( joypad ) {
  if ( !joypad?.enabled || typeof navigator.getGamepads !== "function" ) {
    return [];
  }

  const maxCount = joypad.count ?? 1;
  const deviceId = joypad.deviceId || "";
  const matched = [];

  for ( const gp of navigator.getGamepads() ) {
    if ( matched.length >= maxCount ) {
      break;
    }

    if ( !gp || !gp.connected ) {
      continue;
    }

    if ( deviceId && gp.id !== deviceId ) {
      continue;
    }

    matched.push( gp );
  }

  return matched;
}

// Reads one stick's pair of axes, applying the deadzone and mapping to canvas
// space. `axisIndexX`/`axisIndexY` select the left stick (0, 1) or the right
// stick (2, 3).
function _collectJoypadStick(
  opts, p, out, axisIndexX, axisIndexY
) {
  const joypad = opts.joypad;
  const deadzone = joypad?.deadzone ?? 0.1;

  for ( const gp of _resolveJoypads( joypad ) ) {
    let axisX = gp.axes[ axisIndexX ] ?? 0;
    let axisY = gp.axes[ axisIndexY ] ?? 0;

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
  }
}

// Left stick: axes[0] = X, axes[1] = Y.
function _collectJoypadLeft(
  opts, p, out
) {
  _collectJoypadStick(
    opts,
    p,
    out,
    0,
    1
  );
}

// Right stick: axes[2] = X, axes[3] = Y. Active by default alongside the left
// stick whenever `joypad.enabled` is on — no separate flag to flip.
function _collectJoypadRight(
  opts, p, out
) {
  _collectJoypadStick(
    opts,
    p,
    out,
    2,
    3
  );
}
