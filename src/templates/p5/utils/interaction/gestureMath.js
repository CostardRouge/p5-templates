/**
 * Pure gesture math — turns raw MediaPipe landmarks into intuitive, bindable
 * scalars (hand openness, fingers raised, suggested depth, pinch, spread …).
 *
 * Deliberately free of any p5 / MediaPipe / runtime imports so it stays cheap
 * to unit-test and to pull into either the sketch runtime or the React options
 * bundle. The stateful smoothing / per-frame caching lives in `gestures.js`;
 * everything here is a deterministic function of its inputs.
 *
 * Hand landmark indices follow the MediaPipe Hand Landmarker model (21 points
 * per hand, see HAND_FINGER_JOINT_INDICES in ./index.js).
 */

// Apparent hand size (wrist → middle-finger MCP, in normalized 0..1 space) maps
// to a 0..1 "suggested depth": small/far hand → 0, large/near hand → 1. The
// span is roughly invariant to where the hand is in frame, so it reads as
// distance-to-camera. Tunable if a camera's field of view differs a lot.
export const HAND_DEPTH_NEAR = 0.30;
export const HAND_DEPTH_FAR = 0.06;

// Finger "extension ratio" = (tip→wrist) / (knuckle→wrist). A curled finger
// sits near its knuckle (~1.0); a fully extended one reaches ~1.9× further.
const FINGER_CURLED_RATIO = 1.0;
const FINGER_EXTENDED_RATIO = 1.9;

// Non-thumb fingers, as { knuckle (MCP), tip } landmark indices.
const FINGER_DEFS = [
  {
    name: "index",
    mcp: 5,
    tip: 8
  },
  {
    name: "middle",
    mcp: 9,
    tip: 12
  },
  {
    name: "ring",
    mcp: 13,
    tip: 16
  },
  {
    name: "pinky",
    mcp: 17,
    tip: 20
  }
];

export const FINGER_KEYS = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky"
];

const WRIST = 0;
const PALM_SCALE_REF = 9; // middle-finger MCP
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const INDEX_MCP = 5;

export function clamp(
  value, lo = 0, hi = 1
) {
  if ( value < lo ) {
    return lo;
  }

  if ( value > hi ) {
    return hi;
  }

  return value;
}

/**
 * Linearly remap `value` from [inMin, inMax] to [outMin, outMax], clamped to the
 * output range. The workhorse behind every gesture → parameter binding.
 */
export function mapClamp(
  value, inMin, inMax, outMin, outMax
) {
  if ( inMax === inMin ) {
    return outMin;
  }

  const t = clamp(
    ( value - inMin ) / ( inMax - inMin ),
    0,
    1
  );

  return outMin + t * ( outMax - outMin );
}

function dist(
  a, b
) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

/**
 * Per-hand metrics from one hand's 21 landmarks. Returns null when the landmark
 * set is missing/degenerate so callers can simply skip it.
 *
 * @param {Array<{x:number,y:number,z?:number}>} lm
 * @returns {null | {
 *   fingerOpen: Record<string, number>,  // 0..1 per finger
 *   openness: number,                    // 0..1 (mean of the four non-thumb fingers)
 *   pinch: number,                       // 0..1 (1 = thumb & index touching)
 *   spread: number,                      // 0..1 (fingertips splayed apart)
 *   depth: number,                       // 0..1 (suggested proximity to camera)
 *   scale: number                        // raw apparent hand size (normalized)
 * }}
 */
export function handMetricsFromLandmarks( lm ) {
  if ( !Array.isArray( lm ) || lm.length < 21 ) {
    return null;
  }

  const wrist = lm[ WRIST ];
  const scale = dist(
    wrist,
    lm[ PALM_SCALE_REF ]
  );

  if ( !( scale > 0 ) ) {
    return null;
  }

  const fingerOpen = {};

  for ( const finger of FINGER_DEFS ) {
    const knuckleSpan = Math.max(
      dist(
        lm[ finger.mcp ],
        wrist
      ),
      1e-6
    );
    const ratio = dist(
      lm[ finger.tip ],
      wrist
    ) / knuckleSpan;

    fingerOpen[ finger.name ] = clamp( ( ratio - FINGER_CURLED_RATIO ) /
      ( FINGER_EXTENDED_RATIO - FINGER_CURLED_RATIO ) );
  }

  // Thumb opens sideways, not along the wrist axis: measure how far its tip sits
  // from the index knuckle (tucked across the palm in a fist → small).
  const thumbRatio = dist(
    lm[ THUMB_TIP ],
    lm[ INDEX_MCP ]
  ) / scale;

  fingerOpen.thumb = clamp( ( thumbRatio - 0.6 ) / ( 1.4 - 0.6 ) );

  const openness = ( fingerOpen.index +
    fingerOpen.middle +
    fingerOpen.ring +
    fingerOpen.pinky ) / 4;

  const pinchRatio = dist(
    lm[ THUMB_TIP ],
    lm[ INDEX_TIP ]
  ) / scale;
  const pinch = 1 - clamp( ( pinchRatio - 0.2 ) / ( 0.9 - 0.2 ) );

  const tipGap = ( dist(
    lm[ INDEX_TIP ],
    lm[ MIDDLE_TIP ]
  ) + dist(
    lm[ MIDDLE_TIP ],
    lm[ RING_TIP ]
  ) + dist(
    lm[ RING_TIP ],
    lm[ PINKY_TIP ]
  ) ) / 3 / scale;
  const spread = clamp( ( tipGap - 0.15 ) / ( 0.7 - 0.15 ) );

  const depth = clamp( ( scale - HAND_DEPTH_FAR ) /
    ( HAND_DEPTH_NEAR - HAND_DEPTH_FAR ) );

  return {
    fingerOpen,
    openness,
    pinch,
    spread,
    depth,
    scale
  };
}

/**
 * Count how many fingers read as "raised", given per-finger openness 0..1.
 */
export function countFingersUp(
  fingerOpen, threshold = 0.5
) {
  if ( !fingerOpen ) {
    return 0;
  }

  return FINGER_KEYS.reduce(
    (
      total, key
    ) => total + ( ( fingerOpen[ key ] ?? 0 ) >= threshold ? 1 : 0 ),
    0
  );
}

/**
 * Suggested depth 0..1 for a detected face from its bounding-box width relative
 * to the capture width (a bigger box → closer → 1).
 */
export function faceDepthFromBox(
  boxWidth, captureWidth
) {
  if ( !( captureWidth > 0 ) ) {
    return 0;
  }

  return clamp( ( boxWidth / captureWidth - 0.15 ) / ( 0.6 - 0.15 ) );
}

// ── Bindable gesture channels ───────────────────────────────────────────────
// The scalar gesture sources exposed to the interactive-bindings system. Each
// `id` is the binding source id (see ../sources.js) and groups under its family
// ("hands" / "face") in the binding picker, exactly like the audio.* scalars.
// Declared here, in the pure module, so the source manifest and the channel
// builder stay in sync (parity-tested).
export const GESTURE_SOURCES = [
  {
    id: "hands.count",
    label: "Hands · Count"
  },
  {
    id: "hands.open",
    label: "Hands · Open count"
  },
  {
    id: "hands.openness",
    label: "Hands · Openness"
  },
  {
    id: "hands.fingers",
    label: "Hands · Fingers up"
  },
  {
    id: "hands.depth",
    label: "Hands · Depth (near)"
  },
  {
    id: "hands.pinch",
    label: "Hands · Pinch"
  },
  {
    id: "hands.spread",
    label: "Hands · Spread"
  },
  {
    id: "face.count",
    label: "Face · Count"
  },
  {
    id: "face.depth",
    label: "Face · Depth (near)"
  }
];

export const GESTURE_SOURCE_IDS = GESTURE_SOURCES.map( ( source ) => source.id );

/**
 * Normalize a gesture metrics snapshot (see ./gestures.js → computeInteractionMetrics)
 * into 0..1 channel values keyed by the GESTURE_SOURCES ids — the contract the
 * binding system expects (every channel publishes 0..1; counts are divided by
 * their natural maxima so the mapping range stays uniform).
 *
 * @param {object} metrics - { hands, hand, face } snapshot
 * @returns {Record<string, number>} keyed by GESTURE_SOURCE_IDS, each 0..1
 */
export function gestureChannelValues( metrics ) {
  const hands = metrics?.hands ?? {};
  const hand = metrics?.hand ?? {};
  const face = metrics?.face ?? {};

  return {
    "hands.count": clamp( ( hands.count ?? 0 ) / 2 ),
    "hands.open": clamp( ( hands.open ?? 0 ) / 2 ),
    "hands.openness": clamp( hands.openness ?? 0 ),
    "hands.fingers": clamp( ( hands.fingers ?? 0 ) / 10 ),
    "hands.depth": clamp( hands.depth ?? 0 ),
    "hands.pinch": clamp( hand.pinch ?? 0 ),
    "hands.spread": clamp( hand.spread ?? 0 ),
    "face.count": clamp( ( face.count ?? 0 ) / 4 ),
    "face.depth": clamp( face.depth ?? 0 )
  };
}
