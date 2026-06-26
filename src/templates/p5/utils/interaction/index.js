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
// The input id the layer currently listens to ("" = every input). Tracked so a
// runtime change of the picker re-wires the message handlers without a reload.
let _midiDeviceId = "";

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

// ── LiDAR (remote iPhone depth over WebSocket) state ───────────────────────
// iOS Safari cannot read the LiDAR itself, so capture always happens in a
// native source (an iOS app, or a USB/desktop bridge); this layer is only the
// receiver. The sketch's browser opens a WebSocket to that source and decodes
// downsampled depth frames. The wire format is source-agnostic — a compact
// binary frame (preferred) or a JSON grid (easy to emit / debug); see the
// _parseLidar* helpers. Reduced to "nearest point" pointers for the pointer
// API, with the full grid exposed via getLidar().
let _lidarInitialized = false;
let _lidarSocket = null;
let _lidarUrl = "";
let _lidarReconnectTimer = null;
const _lidar = {
  enabled: false,
  connected: false,
  width: 0,
  height: 0,
  min: 0,
  max: 0,
  depth: null, // Float32Array, row-major, metres (0 / NaN = no reading)
  confidence: null, // Uint8Array (0..2) or null
  nearest: null, // { x, y, z, depth } — closest in-band cell, canvas space + m
  frames: 0,
  receivedAt: 0
};

// ── Mac lid-angle sensor (WebHID) state ────────────────────────────────────
// Apple ships a hidden HID sensor reporting the screen-hinge angle. It is
// readable straight from the browser via WebHID (Chrome/Edge desktop, Apple
// Silicon) — no native helper. Vendor 0x05AC, product 0x8104, usagePage 0x20,
// usage 0x8A; the angle is a uint16 LE in degrees inside Feature Report 1
// (after the report-id byte). requestDevice() needs a user gesture, so the
// first grant is armed on a one-shot tap like the iOS gyroscope permission.
const LID_ANGLE_VENDOR = 0x05ac;
const LID_ANGLE_USAGE_PAGE = 0x20;
const LID_ANGLE_USAGE = 0x8a;
const LID_ANGLE_REPORT_ID = 1;
const LID_ANGLE_POLL_MS = 60;
let _lidAngleInitialized = false;
let _lidAngleDevice = null;
let _lidAnglePollTimer = null;
let _lidAnglePermissionListener = null;
const _lidAngle = {
  degrees: null,
  connected: false
};

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

  // With no device picked ("") listen to every input; otherwise only the
  // selected one fires, so the other controllers are ignored.
  _midiAccess.inputs.forEach( ( input ) => {
    input.onmidimessage =
      !_midiDeviceId || input.id === _midiDeviceId ? _onMidiMessage : null;
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

// ── LiDAR helpers ──────────────────────────────────────────────────────────

function _resetLidarState() {
  _lidar.connected = false;
  _lidar.width = 0;
  _lidar.height = 0;
  _lidar.min = 0;
  _lidar.max = 0;
  _lidar.depth = null;
  _lidar.confidence = null;
  _lidar.nearest = null;
  _lidar.frames = 0;
  _lidar.receivedAt = 0;
}

function _closeLidar() {
  if ( _lidarReconnectTimer ) {
    clearTimeout( _lidarReconnectTimer );
    _lidarReconnectTimer = null;
  }

  if ( _lidarSocket ) {
    // Drop handlers first so closing doesn't schedule a reconnect.
    _lidarSocket.onopen = null;
    _lidarSocket.onmessage = null;
    _lidarSocket.onerror = null;
    _lidarSocket.onclose = null;

    try {
      _lidarSocket.close();
    } catch {
      // already closing / closed
    }

    _lidarSocket = null;
  }

  _resetLidarState();
}

function _storeLidarFrame(
  width, height, min, max, depth, confidence
) {
  _lidar.width = width;
  _lidar.height = height;
  _lidar.min = min;
  _lidar.max = max;
  _lidar.depth = depth;
  _lidar.confidence = confidence;
  _lidar.frames++;
  _lidar.receivedAt = typeof performance !== "undefined"
    ? performance.now()
    : Date.now();
}

// Decode a binary depth frame:
//   uint16 magic 0x4C44 ("LD") · uint8 version · uint8 flags (bit0 = confidence)
//   uint16 width · uint16 height · float32 min · float32 max
//   float32[w*h] depth (metres) · uint8[w*h] confidence (when the flag is set)
// All little-endian. Returns true on a valid frame.
function _parseLidarBinary( buffer ) {
  const view = new DataView( buffer );

  if ( view.byteLength < 16 || view.getUint16(
    0,
    true
  ) !== 0x4c44 ) {
    return false;
  }

  const flags = view.getUint8( 3 );
  const width = view.getUint16(
    4,
    true
  );
  const height = view.getUint16(
    6,
    true
  );
  const min = view.getFloat32(
    8,
    true
  );
  const max = view.getFloat32(
    12,
    true
  );
  const count = width * height;
  const depthOffset = 16;
  const needed = depthOffset + count * 4 + ( flags & 1 ? count : 0 );

  if ( !count || view.byteLength < needed ) {
    return false;
  }

  const depth = new Float32Array( count );

  for ( let i = 0; i < count; i++ ) {
    depth[ i ] = view.getFloat32(
      depthOffset + i * 4,
      true
    );
  }

  let confidence = null;

  if ( flags & 1 ) {
    confidence = new Uint8Array( count );

    const confOffset = depthOffset + count * 4;

    for ( let i = 0; i < count; i++ ) {
      confidence[ i ] = view.getUint8( confOffset + i );
    }
  }

  _storeLidarFrame(
    width,
    height,
    min,
    max,
    depth,
    confidence
  );

  return true;
}

// Decode a JSON depth frame: { width, height, min?, max?, data:[…], confidence?:[…] }.
function _parseLidarJson( text ) {
  let msg;

  try {
    msg = JSON.parse( text );
  } catch {
    return false;
  }

  const data = msg?.data ?? msg?.depth;

  if ( !Array.isArray( data ) || !msg.width || !msg.height ) {
    return false;
  }

  const count = msg.width * msg.height;

  if ( data.length < count ) {
    return false;
  }

  const depth = Float32Array.from( data.slice(
    0,
    count
  ) );
  const confidence = Array.isArray( msg.confidence )
    ? Uint8Array.from( msg.confidence.slice(
      0,
      count
    ) )
    : null;

  _storeLidarFrame(
    msg.width,
    msg.height,
    msg.min ?? 0,
    msg.max ?? 0,
    depth,
    confidence
  );

  return true;
}

function _onLidarMessage( event ) {
  if ( typeof event.data === "string" ) {
    _parseLidarJson( event.data );
  } else if ( event.data instanceof ArrayBuffer ) {
    _parseLidarBinary( event.data );
  }
}

// Open (or reopen) the WebSocket to the depth source. Safe to call every frame:
// it no-ops while already connected to the requested url. Mixed-content note:
// an https:// page cannot open a ws:// socket — view the sketch over
// http://localhost (dev) or expose the source over wss:// for production.
function _initLidar( opts ) {
  const url = opts.lidar?.url || "";

  // Already settled for this endpoint (connected, or intentionally empty).
  if ( _lidarInitialized && _lidarUrl === url && ( _lidarSocket || !url ) ) {
    return;
  }

  // URL changed at runtime → drop the previous socket before opening a new one.
  _closeLidar();

  _lidarInitialized = true;
  _lidarUrl = url;

  if ( !url || typeof WebSocket === "undefined" ) {
    return;
  }

  let socket;

  try {
    socket = new WebSocket( url );
  } catch {
    // Malformed url or blocked (e.g. ws:// from https://) — wait for a url
    // change rather than spinning a reconnect loop that can never succeed.
    return;
  }

  socket.binaryType = "arraybuffer";
  _lidarSocket = socket;

  socket.onopen = () => {
    _lidar.connected = true;
  };

  socket.onmessage = _onLidarMessage;

  socket.onerror = () => {
    // onclose fires next and owns the reconnect.
  };

  socket.onclose = () => {
    _lidar.connected = false;

    // Reconnect only while this is still the active socket (dispose / url change
    // nulls _lidarSocket first, which suppresses the retry).
    if ( _lidarSocket === socket && _lidarInitialized ) {
      _lidarSocket = null;
      _lidarReconnectTimer = setTimeout(
        () => {
          _lidarReconnectTimer = null;

          if ( _lidarInitialized && _lidarUrl === url ) {
            _initLidar( {
              lidar: {
                url
              }
            } );
          }
        },
        2000
      );
    }
  };
}

// ── Mac lid-angle (WebHID) helpers ─────────────────────────────────────────

// Read Feature Report 1 and cache the hinge angle. WebHID hands back a DataView
// whose first byte is the report id, so the uint16 LE angle sits at offset 1.
async function _pollLidAngle() {
  if ( !_lidAngleDevice || !_lidAngleDevice.opened ) {
    return;
  }

  try {
    const report = await _lidAngleDevice.receiveFeatureReport( LID_ANGLE_REPORT_ID );

    if ( report && report.byteLength >= 3 ) {
      _lidAngle.degrees = report.getUint16(
        1,
        true
      );
      _lidAngle.connected = true;
    }
  } catch {
    // Transient read failure — keep the last angle and try again next tick.
  }
}

function _startLidAnglePolling() {
  if ( _lidAnglePollTimer || typeof window === "undefined" ) {
    return;
  }

  _lidAnglePollTimer = window.setInterval(
    _pollLidAngle,
    LID_ANGLE_POLL_MS
  );
}

async function _openLidAngleDevice( device ) {
  if ( !device ) {
    return;
  }

  try {
    if ( !device.opened ) {
      await device.open();
    }

    _lidAngleDevice = device;
    _startLidAnglePolling();
  } catch {
    // Could not open (already claimed, permission revoked) — stay disconnected.
  }
}

function _removeLidAnglePermissionListener() {
  if ( !_lidAnglePermissionListener || typeof window === "undefined" ) {
    return;
  }

  window.removeEventListener(
    "click",
    _lidAnglePermissionListener
  );
  window.removeEventListener(
    "touchend",
    _lidAnglePermissionListener
  );
  _lidAnglePermissionListener = null;
}

function _lidAngleMatches( device ) {
  return device.vendorId === LID_ANGLE_VENDOR &&
    ( device.collections ?? [] ).some( ( c ) =>
      c.usagePage === LID_ANGLE_USAGE_PAGE && c.usage === LID_ANGLE_USAGE );
}

// Lazily wire WebHID the first time the collector runs. Already-granted devices
// (navigator.hid.getDevices) open immediately; otherwise requestDevice() must
// run from a user gesture, so arm a one-shot tap/click that prompts for it.
function _initLidAngle() {
  if ( _lidAngleInitialized ) {
    return;
  }

  _lidAngleInitialized = true;

  if ( typeof navigator === "undefined" || !navigator.hid ) {
    return; // WebHID unavailable (non-Chromium / insecure context)
  }

  const filters = [
    {
      vendorId: LID_ANGLE_VENDOR,
      usagePage: LID_ANGLE_USAGE_PAGE,
      usage: LID_ANGLE_USAGE
    }
  ];

  navigator.hid.getDevices()
    .then( ( devices ) => {
      const granted = devices.find( _lidAngleMatches );

      if ( granted ) {
        _openLidAngleDevice( granted );

        return;
      }

      // Not granted yet — prompt on the next user gesture.
      const requestOnGesture = () => {
        _removeLidAnglePermissionListener();
        navigator.hid.requestDevice( {
          filters
        } )
          .then( ( picked ) => _openLidAngleDevice( picked?.[ 0 ] ) )
          .catch( () => {} );
      };

      _lidAnglePermissionListener = requestOnGesture;
      window.addEventListener(
        "click",
        requestOnGesture
      );
      window.addEventListener(
        "touchend",
        requestOnGesture
      );
    } )
    .catch( () => {} );
}

function _disposeLidAngle() {
  _removeLidAnglePermissionListener();

  if ( _lidAnglePollTimer && typeof window !== "undefined" ) {
    window.clearInterval( _lidAnglePollTimer );
    _lidAnglePollTimer = null;
  }

  if ( _lidAngleDevice ) {
    try {
      _lidAngleDevice.close();
    } catch {
      // ignore close failures on teardown
    }

    _lidAngleDevice = null;
  }

  _lidAngleInitialized = false;
  _lidAngle.degrees = null;
  _lidAngle.connected = false;
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
  _midiDeviceId = "";
  _midiNotes.clear();

  // ── Audio reset (lazy init triggered by _collectAudio) ───────────────────
  _closeAudio();
  _audioInitialized = false;
  _audioDeviceId = "";

  // ── LiDAR reset (lazy connect triggered by _collectLidar) ────────────────
  _closeLidar();
  _lidarInitialized = false;
  _lidarUrl = "";

  // ── Mac lid-angle reset (lazy init triggered by _collectLidAngle) ────────
  _disposeLidAngle();

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
  _midiDeviceId = "";
  _midiNotes.clear();

  // Audio — stop the mic tracks (not just close the context) so the browser
  // microphone indicator clears when the sketch is torn down.
  _closeAudio();
  _audioInitialized = false;
  _audioDeviceId = "";

  // LiDAR — close the WebSocket so we stop receiving depth frames.
  _closeLidar();
  _lidarInitialized = false;
  _lidarUrl = "";

  // Mac lid-angle — stop polling and release the HID device.
  _disposeLidAngle();

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
  ],
  [
    "lidar",
    _collectLidar
  ],
  [
    "lidAngle",
    _collectLidAngle
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
  addPerPoint(
    "lidar",
    _collectLidar
  );
  addPerPoint(
    "lidAngle",
    _collectLidAngle
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
    _initMidi( opts );

    return;
  }

  // Re-wire when the picker changes input at runtime, dropping notes still held
  // on the previously-selected device so they don't linger.
  const desiredDevice = midi.deviceId || "";

  if ( _midiDeviceId !== desiredDevice ) {
    _midiDeviceId = desiredDevice;
    _midiNotes.clear();
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
 * Snapshot of the latest LiDAR depth frame received over WebSocket. Returns the
 * same live object every call (mutated in place). `depth` is a row-major
 * Float32Array of metres (0 = no reading); `nearest` is the closest in-band
 * cell mapped to canvas space + metres. Empty until a source connects.
 *
 * @returns {object} { enabled, connected, width, height, min, max, depth, confidence, nearest, frames, receivedAt }
 */
export function getLidar() {
  return _lidar;
}

/**
 * Latest Mac lid (screen-hinge) angle in degrees, read over WebHID, or
 * `degrees: null` until a device is granted and opened. Chrome/Edge desktop on
 * Apple Silicon only.
 *
 * @returns {object} { degrees, connected }
 */
export function getLidAngle() {
  return _lidAngle;
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
  // "" reads any connected pad; a specific id restricts to matching pads
  // (identical controllers share an id, so several may still match).
  const deviceId = joypad.deviceId || "";
  let added = 0;

  for ( let i = 0; i < gamepads.length && added < maxCount; i++ ) {
    const gp = gamepads[ i ];

    if ( !gp || !gp.connected ) {
      continue;
    }

    if ( deviceId && gp.id !== deviceId ) {
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

// The remote depth grid is camera-space (column → x, row → y). Keep the
// `count` nearest valid cells inside the [near, far] band and emit them as
// pointers — like fingertips, but driven by whatever is closest to the phone.
// z carries the normalised depth (0 = near, 1 = far) so 3D-aware sketches can
// read v.z while the x/y still drive the standard 2D pointer overlay.
function _collectLidar(
  opts, p, out
) {
  const lidar = opts.lidar;

  if ( !lidar?.enabled ) {
    // Toggled off: release the socket so we stop holding the LAN connection.
    if ( _lidarInitialized ) {
      _closeLidar();
      _lidarInitialized = false;
      _lidarUrl = "";
    }

    _lidar.enabled = false;

    return;
  }

  _lidar.enabled = true;

  // Lazy connect, and reconnect when the url changes at runtime.
  if ( !_lidarInitialized || _lidarUrl !== ( lidar.url || "" ) ) {
    _initLidar( opts );
  }

  const depth = _lidar.depth;

  if ( !depth || !_lidar.width || !_lidar.height ) {
    _lidar.nearest = null;

    return;
  }

  const w = _lidar.width;
  const h = _lidar.height;
  const flip = lidar.flip ?? true;
  const count = Math.max(
    1,
    lidar.count ?? 5
  );
  const near = lidar.near ?? ( _lidar.min || 0.2 );
  const far = lidar.far ?? ( _lidar.max || 4 );
  const minConf = lidar.minConfidence ?? 0;
  const conf = _lidar.confidence;

  // Collect valid in-band cells, then keep the nearest `count`. A small grid
  // (e.g. 32×24 ≈ 768 cells) keeps this comfortably under one frame.
  const cells = [];

  for ( let i = 0; i < depth.length; i++ ) {
    const d = depth[ i ];

    if ( !( d > 0 ) || d < near || d > far ) {
      continue;
    }

    if ( conf && conf[ i ] < minConf ) {
      continue;
    }

    cells.push( {
      i,
      d
    } );
  }

  cells.sort( (
    a, b
  ) => a.d - b.d );

  const limit = Math.min(
    count,
    cells.length
  );
  let nearest = null;

  for ( let n = 0; n < limit; n++ ) {
    const {
      i, d
    } = cells[ n ];
    const col = i % w;
    const row = Math.floor( i / w );
    const nx = ( col + 0.5 ) / w;
    const z = far > near
      ? p.constrain(
        ( d - near ) / ( far - near ),
        0,
        1
      )
      : 0;
    const vector = p.createVector(
      ( flip ? 1 - nx : nx ) * p.width,
      ( ( row + 0.5 ) / h ) * p.height,
      z
    );

    out.push( vector );

    if ( n === 0 ) {
      nearest = {
        x: vector.x,
        y: vector.y,
        z,
        depth: d
      };
    }
  }

  _lidar.nearest = nearest;
}

// The lid (screen-hinge) angle is a single scalar; map it onto the chosen axis
// while the other axis stays centred — same spirit as the gyroscope collector.
function _collectLidAngle(
  opts, p, out
) {
  const lid = opts.lidAngle;

  if ( !lid?.enabled ) {
    return;
  }

  if ( !_lidAngleInitialized ) {
    _initLidAngle();
  }

  if ( _lidAngle.degrees === null ) {
    return;
  }

  const minAngle = lid.minAngle ?? 0;
  const maxAngle = lid.maxAngle ?? 135;
  const ox = lid.offset?.x ?? 0;
  const oy = lid.offset?.y ?? 0;
  const t = p.constrain(
    p.map(
      _lidAngle.degrees,
      minAngle,
      maxAngle,
      0,
      1
    ),
    0,
    1
  );

  out.push( p.createVector(
    ( lid.axis === "y" ? 0.5 : t ) * p.width + ox,
    ( lid.axis === "y" ? t : 0.5 ) * p.height + oy
  ) );
}
