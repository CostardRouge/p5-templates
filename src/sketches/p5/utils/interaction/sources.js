// ── Interaction source manifest ─────────────────────────────────────────────
// The single declaration of which interaction handlers are bindable, and how
// they appear in the binding UI's "Input" category. This module is PURE (no
// imports) so the React editor bundle can import it WITHOUT pulling in the
// interaction handler (and transitively MediaPipe).
//
// The vector2d ids below MUST mirror the flat-collector tags in
// `index.js` (`_FLAT_COLLECTORS`) — those are the `source` strings
// `getPointersDebug()` emits, which `channels.js` turns into channels. Adding a
// source = add one entry to `_FLAT_COLLECTORS` AND one entry here.
//
// The `audio.*` scalars are semantic channels read from `getAudio().bands`
// (see channels.js). They are the first per-source semantic mapping; richer
// per-source channels (hands.pinch, gyro.tilt, midi.cc, …) follow the same
// pattern.

export const INTERACTION_SOURCES = [
  // ── Generic position sources (one vector2d channel each) ──────────────────
  {
    id: "mouse",
    type: "vector2d",
    label: "Mouse"
  },
  {
    id: "touch",
    type: "vector2d",
    label: "Touch"
  },
  {
    id: "hands",
    type: "vector2d",
    label: "Hands"
  },
  {
    id: "fingers",
    type: "vector2d",
    label: "Fingers"
  },
  {
    id: "face",
    type: "vector2d",
    label: "Face"
  },
  {
    id: "faceMesh",
    type: "vector2d",
    label: "Face mesh"
  },
  {
    id: "body",
    type: "vector2d",
    label: "Body"
  },
  {
    id: "orbit",
    type: "vector2d",
    label: "Orbit"
  },
  {
    id: "perlinNoise",
    type: "vector2d",
    label: "Perlin noise"
  },
  {
    id: "gyroscope",
    type: "vector2d",
    label: "Gyroscope"
  },
  {
    id: "midi",
    type: "vector2d",
    label: "MIDI"
  },
  {
    id: "audio",
    type: "vector2d",
    label: "Audio"
  },
  {
    id: "joypad",
    type: "vector2d",
    label: "Joypad · Left stick"
  },
  {
    id: "joypadRight",
    type: "vector2d",
    label: "Joypad · Right stick"
  },

  // ── Semantic audio scalars (from getAudio().bands) ────────────────────────
  {
    id: "audio.level",
    type: "scalar",
    label: "Audio · Level"
  },
  {
    id: "audio.sub",
    type: "scalar",
    label: "Audio · Sub"
  },
  {
    id: "audio.bass",
    type: "scalar",
    label: "Audio · Bass"
  },
  {
    id: "audio.midLow",
    type: "scalar",
    label: "Audio · Mid-low"
  },
  {
    id: "audio.mid",
    type: "scalar",
    label: "Audio · Mid"
  },
  {
    id: "audio.midHigh",
    type: "scalar",
    label: "Audio · Mid-high"
  },
  {
    id: "audio.treble",
    type: "scalar",
    label: "Audio · Treble"
  },
  {
    id: "audio.presence",
    type: "scalar",
    label: "Audio · Presence"
  },

  // ── Semantic hand/face gesture scalars (from getInteractionMetrics()) ──────
  // Derived, intuitive values about what the camera sees — open vs closed hand,
  // fingers/hands raised, suggested depth (nearness), pinch, spread, face
  // presence/depth. Each is published 0..1 by channels.js (gestureChannelValues)
  // and grouped under the existing "Hands" / "Face" families in the picker. The
  // canonical id list + normalization live in ./gestureMath.js (GESTURE_SOURCES)
  // — kept in sync by a parity test.
  {
    id: "hands.count",
    type: "scalar",
    label: "Hands · Count"
  },
  {
    id: "hands.open",
    type: "scalar",
    label: "Hands · Open count"
  },
  {
    id: "hands.openness",
    type: "scalar",
    label: "Hands · Openness"
  },
  {
    id: "hands.fingers",
    type: "scalar",
    label: "Hands · Fingers up"
  },
  {
    id: "hands.depth",
    type: "scalar",
    label: "Hands · Depth (near)"
  },
  {
    id: "hands.pinch",
    type: "scalar",
    label: "Hands · Pinch"
  },
  {
    id: "hands.spread",
    type: "scalar",
    label: "Hands · Spread"
  },
  {
    id: "face.count",
    type: "scalar",
    label: "Face · Count"
  },
  {
    id: "face.depth",
    type: "scalar",
    label: "Face · Depth (near)"
  },

  // ── Semantic face-mesh blendshape scalars (from the faceMesh tracker) ──────
  // FaceLandmarker's expression scores, surfaced as bindable 0..1 channels.
  // Populated only when `vision.faceMesh` is enabled with blendshapes on.
  {
    id: "face.mouthOpen",
    type: "scalar",
    label: "Face · Mouth open"
  },
  {
    id: "face.smile",
    type: "scalar",
    label: "Face · Smile"
  },
  {
    id: "face.blinkLeft",
    type: "scalar",
    label: "Face · Blink (left)"
  },
  {
    id: "face.blinkRight",
    type: "scalar",
    label: "Face · Blink (right)"
  },
  {
    id: "face.browUp",
    type: "scalar",
    label: "Face · Brow raise"
  }
];

// The flat-collector source tags getPointersDebug() emits (mirrors
// `_FLAT_COLLECTORS` in index.js). Exported for the parity unit test.
export const FLAT_SOURCE_IDS = [
  "mouse",
  "touch",
  "hands",
  "fingers",
  "face",
  "faceMesh",
  "body",
  "orbit",
  "perlinNoise",
  "gyroscope",
  "midi",
  "audio",
  "joypad",
  "joypadRight"
];

// The getAudio().bands keys exposed as `audio.<band>` scalar channels.
export const AUDIO_BANDS = [
  "sub",
  "bass",
  "midLow",
  "mid",
  "midHigh",
  "treble",
  "presence"
];
