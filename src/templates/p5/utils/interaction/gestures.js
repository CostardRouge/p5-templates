/**
 * Gesture snapshot — the live, semantic view of what the camera sees: how many
 * hands/fingers are raised, whether a hand is open or closed (a fist), how near
 * a hand is to the screen (suggested depth), pinch, spread, and basic face
 * presence/depth.
 *
 * Built on the raw landmark math in ./gestureMath.js, this layer adds the
 * runtime concerns: reading the latest MediaPipe results, temporal smoothing so
 * bound parameters don't jitter, finger-up hysteresis so counts don't flicker,
 * and a once-per-frame cache.
 *
 * It feeds the interactive-bindings system: index.js re-exports
 * getInteractionMetrics(), channels.js normalizes the snapshot into 0..1
 * `hands.*` / `face.*` scalar channels (via gestureChannelValues), and the
 * binding picker lists them from the source manifest (./sources.js).
 */

import mediapipe, {
  getTaskResult
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  faceDepthFromBox,
  FINGER_KEYS,
  handMetricsFromLandmarks,
  HAND_DEPTH_FAR,
  HAND_DEPTH_NEAR,
  mapClamp
} from "@/p5/utils/interaction/gestureMath.js";

// Results older than this read as "nothing detected" (mirrors the collectors in
// ./index.js) so a stalled pipeline never freezes a stale gesture.
const VISION_RESULT_TTL_MS = 1500;

// EMA factor for smoothing (0..1): higher reacts faster, lower is calmer.
const SMOOTH_ALPHA = 0.4;

// Finger-up hysteresis: rises past the high band, falls below the low band, and
// holds its previous state in between — kills single-frame count flicker.
const FINGER_UP_HIGH = 0.6;
const FINGER_UP_LOW = 0.4;

const _smooth = new Map(); // key → smoothed scalar
const _up = new Map(); // "h{i}:{finger}:up" → boolean
const _cache = {
  frame: -1,
  metrics: null
};

function _ema(
  key, value
) {
  const prev = _smooth.get( key );
  const next = prev == null ? value : prev + SMOOTH_ALPHA * ( value - prev );

  _smooth.set(
    key,
    next
  );

  return next;
}

/** Drop per-hand smoothing/up state for hands no longer on screen. */
function _pruneHandState( seen ) {
  for ( const key of _smooth.keys() ) {
    if ( /^h\d+:/.test( key ) && !seen.has( key ) ) {
      _smooth.delete( key );
    }
  }

  for ( const key of _up.keys() ) {
    if ( !seen.has( key ) ) {
      _up.delete( key );
    }
  }
}

function _emptyMetrics() {
  return {
    hands: {
      count: 0,
      open: 0,
      closed: 0,
      openness: 0,
      fingers: 0,
      depth: 0
    },
    hand: {
      present: 0,
      openness: 0,
      fingers: 0,
      depth: 0,
      pinch: 0,
      spread: 0
    },
    face: {
      count: 0,
      present: 0,
      depth: 0
    }
  };
}

function _collectHandMetrics( opts ) {
  const vision = opts?.vision ?? {};
  const handsCfg = vision.hands ?? {};
  const maxHands = handsCfg.maxHands ?? 2;
  const results = vision.enabled === false
    ? []
    : getTaskResult(
      "hands",
      VISION_RESULT_TTL_MS
    )?.landmarks ?? [];

  const perHand = [];
  const seen = new Set();

  results.slice(
    0,
    maxHands
  ).forEach( (
    lm, i
  ) => {
    const raw = handMetricsFromLandmarks( lm );

    if ( !raw ) {
      return;
    }

    const smoothedFingers = {};

    FINGER_KEYS.forEach( ( finger ) => {
      const key = `h${ i }:${ finger }`;

      seen.add( key );
      smoothedFingers[ finger ] = _ema(
        key,
        raw.fingerOpen[ finger ] ?? 0
      );
    } );

    // Finger-up count with hysteresis on the smoothed openness.
    let fingersUp = 0;

    FINGER_KEYS.forEach( ( finger ) => {
      const upKey = `h${ i }:${ finger }:up`;
      const prev = _up.get( upKey ) ?? false;
      const value = smoothedFingers[ finger ];
      const up = value > FINGER_UP_HIGH
        ? true
        : value < FINGER_UP_LOW ? false : prev;

      _up.set(
        upKey,
        up
      );
      seen.add( upKey );

      if ( up ) {
        fingersUp += 1;
      }
    } );

    const scaleKey = `h${ i }:scale`;
    const pinchKey = `h${ i }:pinch`;
    const spreadKey = `h${ i }:spread`;

    seen.add( scaleKey );
    seen.add( pinchKey );
    seen.add( spreadKey );

    const scale = _ema(
      scaleKey,
      raw.scale
    );
    const openness = ( smoothedFingers.index +
      smoothedFingers.middle +
      smoothedFingers.ring +
      smoothedFingers.pinky ) / 4;

    perHand.push( {
      openness,
      fingersUp,
      depth: mapClamp(
        scale,
        HAND_DEPTH_FAR,
        HAND_DEPTH_NEAR,
        0,
        1
      ),
      pinch: _ema(
        pinchKey,
        raw.pinch
      ),
      spread: _ema(
        spreadKey,
        raw.spread
      ),
      scale
    } );
  } );

  _pruneHandState( seen );

  return perHand;
}

function _collectFaceMetrics( opts ) {
  const vision = opts?.vision ?? {};
  const faceCfg = vision.face ?? {};
  const maxFaces = faceCfg.maxFaces ?? 1;
  const minConf = faceCfg.confidence ?? 0.5;
  const detections = vision.enabled === false
    ? []
    : getTaskResult(
      "faces",
      VISION_RESULT_TTL_MS
    )?.detections ?? [];

  const capW = mediapipe.capture?.size?.width ?? 320;
  const faces = detections
    .filter( ( det ) => ( det.categories?.[ 0 ]?.score ?? 1 ) >= minConf )
    .slice(
      0,
      maxFaces
    );

  let depth = 0;

  faces.forEach( ( det ) => {
    depth = Math.max(
      depth,
      faceDepthFromBox(
        det.boundingBox?.width ?? 0,
        capW
      )
    );
  } );

  return {
    count: faces.length,
    present: faces.length > 0 ? 1 : 0,
    // Persisted key (never pruned): decays smoothly to 0 when faces leave.
    depth: _ema(
      "face:depth",
      depth
    )
  };
}

/**
 * Compute the gesture snapshot for `opts` (the sketch's `interaction` block).
 * Cached per frame. Reads the latest vision results; does NOT start the camera
 * (the caller — getInteractionMetrics in ./index.js, or the channels sampler —
 * has already ensured the pipeline is running).
 *
 * @param {object} [opts] - interaction options
 * @returns {ReturnType<typeof _emptyMetrics>}
 */
export function computeInteractionMetrics( opts ) {
  const p = getP5();
  const frame = p?.frameCount ?? 0;

  if ( _cache.frame === frame && _cache.metrics ) {
    return _cache.metrics;
  }

  if ( !opts || opts.enabled === false ) {
    _cache.frame = frame;
    _cache.metrics = _emptyMetrics();

    return _cache.metrics;
  }

  const perHand = _collectHandMetrics( opts );
  const count = perHand.length;
  const fingers = perHand.reduce(
    (
      total, hand
    ) => total + hand.fingersUp,
    0
  );
  const open = perHand.filter( ( hand ) => hand.openness > 0.5 ).length;
  const closed = perHand.filter( ( hand ) => hand.openness < 0.3 ).length;
  const opennessAgg = count
    ? perHand.reduce(
      (
        sum, hand
      ) => sum + hand.openness,
      0
    ) / count
    : 0;
  const depthAgg = count
    ? Math.max( ...perHand.map( ( hand ) => hand.depth ) )
    : 0;
  // The closest (largest) hand drives the single-hand pinch / spread values.
  const primary = count
    ? perHand.reduce( (
      best, hand
    ) => ( hand.scale > best.scale ? hand : best ) )
    : null;

  const metrics = _emptyMetrics();

  metrics.hands = {
    count,
    open,
    closed,
    openness: opennessAgg,
    fingers,
    depth: depthAgg
  };

  if ( primary ) {
    metrics.hand = {
      present: 1,
      openness: primary.openness,
      fingers: primary.fingersUp,
      depth: primary.depth,
      pinch: primary.pinch,
      spread: primary.spread
    };
  }

  metrics.face = _collectFaceMetrics( opts );

  _cache.frame = frame;
  _cache.metrics = metrics;

  return metrics;
}
