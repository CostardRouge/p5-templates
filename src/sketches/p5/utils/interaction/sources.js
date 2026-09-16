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
// `derived: true` marks a channel COMPUTED FROM OTHER CHANNELS rather than read
// from its own control — `midi.ccLast` mirrors the last CC to move,
// `audio.level` averages the bands. They are bindable like any other, but MIDI
// learn must skip them: a mirror moves exactly as much as the knob it is
// mirroring, so a "which channel moved most" detector would hand back the
// mirror and the assignment would not be stable. See `observeForLearn`.
//
// The `audio.*` scalars are semantic channels read from `getAudio().bands`
// (see channels.js). They were the first per-source semantic mapping; the
// `hands.*` / `face.*` gesture scalars and the `midi.cc*` control-change
// scalars follow the same pattern — a richer per-source channel is one entry
// here plus one collector in channels.js.

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
    label: "Audio · Level",
    // The mean of the bands below, so it moves whenever any of them does.
    derived: true
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

  // ── MIDI control change (from getMidiControls()) ──────────────────────────
  // A knob/fader position, normalized 0..1 from its raw 0–127 value by
  // channelsAdapter.midiControlChannels. The per-control channels are MINTED AT
  // RUNTIME, one `midi.cc<n>` per CC number actually received, so they are not
  // listed here — see MIDI_CC_LAST_ID below for why a fixed list cannot work.
  // Only the learn channel is static, because it exists before any CC arrives.
  {
    id: "midi.ccLast",
    type: "scalar",
    label: "MIDI · Last moved CC",
    // Mirrors whichever control moved last, so it is never the answer to
    // "which control did you just move" — see `derived` below.
    derived: true
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

// The channel id prefix for a single MIDI control: `midi.cc29` is CC 29. The id
// is the CC NUMBER, so a binding saved today still addresses the same physical
// knob tomorrow — a slot numbered by arrival order would not survive a reload.
//
// There is deliberately NO fixed list of them. A Launchkey Mini's eight pots
// send CC 29, 79, 80, 104, 108, 109, 113 and 112 — not contiguous, and not even
// in panel order — so any guessed set is dead on arrival for real hardware.
// midiControlChannels mints one channel per CC actually received instead, and
// the binding picker widens its list from the live snapshot (see
// `BindingAffordance/useLiveChannels.ts`).
export const MIDI_CC_PREFIX = "midi.cc";

// The channel id for the "last moved CC" learn channel: the one MIDI scalar
// that exists before any CC has arrived, so it is the only one in the manifest.
export const MIDI_CC_LAST_ID = "midi.ccLast";

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
