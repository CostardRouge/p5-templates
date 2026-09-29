import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";
import {
  handClipLayout
} from "@/p5/shared/handClip.js";

// ── Hand-clip recorder ──────────────────────────────────────────────────────
// Accumulates a raw take — timestamped, normalized hand landmarks — straight
// from MediaPipe's latest HandLandmarker result, for `bakeHandClip()` to turn
// into a `p5t-handclip`. Two things it gets right that a naive "push the hand
// every draw() call" would not:
//
//   • It samples on INFERENCE, not on the draw loop: a frame is pushed only
//     when `mediapipe.tasks.hands.updatedAt` advanced. The draw loop runs at
//     60 fps while inference runs at ~25–35, so polling per frame would store
//     every result two or three times — and duplicated samples read as
//     micro-freezes once the take is resampled (process.js dedupes as a second
//     guard, but the timing is only honest if the timestamps are).
//   • It timestamps with the inference's own completion time (`updatedAt`,
//     performance.now()-based), not the draw frame that noticed it.
//
// Landmarks are stored NORMALIZED (0..1 in the capture frame, x mirrored when
// the capture is flipped — the same orientation `_normToCanvas` gives the
// interaction layer), never in canvas pixels, so a clip replays at any canvas
// size. The recorder is real-time by nature (it captures a human); it does not
// touch the loop clock and is not meant to run inside a deterministic capture.

// MediaPipe hand model indices for the compact layout: wrist, then the five
// fingertips (thumb, index, middle, ring, pinky).
const TIPS_6_INDICES = [
  0,
  4,
  8,
  12,
  16,
  20
];

function handednessOf(
  result, index
) {
  // tasks-vision 0.10 names the field `handednesses`; later builds `handedness`.
  const list = result?.handedness ?? result?.handednesses;
  const category = list?.[ index ]?.[ 0 ];

  return category?.categoryName ?? category?.displayName ?? "";
}

function pickHand(
  result, wanted
) {
  const hands = result?.landmarks ?? [];

  if ( hands.length === 0 ) {
    return -1;
  }

  if ( typeof wanted === "number" ) {
    return hands[ wanted ] ? wanted : -1;
  }

  if ( wanted === "Left" || wanted === "Right" ) {
    for ( let i = 0; i < hands.length; i++ ) {
      if ( handednessOf(
        result,
        i
      ) === wanted ) {
        return i;
      }
    }

    return -1;
  }

  return 0;
}

function toPoints(
  landmarks, layout, flip
) {
  const indices = layout === "tips-6"
    ? TIPS_6_INDICES
    : landmarks.map( (
      _, i
    ) => i );
  const points = [];

  for ( const i of indices ) {
    const pt = landmarks[ i ];

    if ( !pt ) {
      return null;
    }

    points.push( {
      x: flip ? 1 - pt.x : pt.x,
      y: pt.y
    } );
  }

  return points;
}

/**
 * Create a recorder. Call `update()` every frame (recording or not — it also
 * keeps `latest` fresh for a live skeleton); `start()` / `stop()` bracket a
 * take. `stop()` returns the raw take ready for `bakeHandClip()`.
 */
export function createClipRecorder() {
  const state = {
    recording: false,
    layout: "landmarks-21",
    hand: "any",
    flip: true,
    startedAt: 0,
    t0: 0,
    lastUpdatedAt: 0,
    samples: [],
    handedness: "",
    dropouts: 0,
    // Freshest converted hand seen (recording or not), for live feedback.
    latest: null,
    latestAt: 0
  };

  return {
    get recording() {
      return state.recording;
    },

    get samples() {
      return state.samples;
    },

    /** Latest converted hand points (normalized), or null when none tracked. */
    get latest() {
      return state.latest;
    },

    /**
     * Seconds since `start()` (0 while idle) — wall clock, so a take with no
     * hand yet still counts toward its max length. Sample timestamps use the
     * separate `t0`, which only starts on the first tracked hand.
     */
    get elapsed() {
      if ( !state.recording ) {
        return 0;
      }

      return Math.max(
        0,
        ( performance.now() - state.startedAt ) / 1000
      );
    },

    /** Live stats for the studio HUD. */
    get stats() {
      return {
        samples: state.samples.length,
        dropouts: state.dropouts,
        inferencesPerSecond: mediapipe.stats?.inferencesPerSecond ?? 0,
        inferenceMilliseconds: mediapipe.stats?.inferenceMilliseconds ?? 0
      };
    },

    /**
     * Begin a take.
     *
     * @param {object} [config]
     * @param {string} [config.layout="landmarks-21"] - Point layout to store.
     * @param {number|"Left"|"Right"|"any"} [config.hand="any"] - Which
     *   tracked hand to record: an index, a MediaPipe handedness label, or
     *   the first one seen.
     * @param {boolean} [config.flip=true] - Mirror x, matching a flipped
     *   capture (what the interaction layer does for the webcam).
     */
    start( {
      layout = "landmarks-21",
      hand = "any",
      flip = true
    } = {} ) {
      handClipLayout( layout );
      state.recording = true;
      state.layout = layout;
      state.hand = hand;
      state.flip = flip;
      state.startedAt = performance.now();
      state.t0 = 0;
      state.lastUpdatedAt = 0;
      state.samples = [];
      state.handedness = "";
      state.dropouts = 0;
    },

    /**
     * Poll the latest inference; push one sample when it advanced and the
     * wanted hand is in it. Cheap enough to call every frame. Outside a take
     * the optional `config` (same keys as `start`) is applied immediately, so
     * `latest` follows the studio's current layout/hand/flip settings.
     */
    update( config ) {
      if ( !state.recording && config ) {
        if ( config.layout && config.layout !== state.layout ) {
          handClipLayout( config.layout );
          state.layout = config.layout;
          state.latest = null;
        }

        state.hand = config.hand ?? state.hand;
        state.flip = config.flip ?? state.flip;
      }

      const entry = mediapipe.tasks?.hands;

      if ( !entry?.result || !entry.updatedAt || entry.updatedAt === state.lastUpdatedAt ) {
        return;
      }

      state.lastUpdatedAt = entry.updatedAt;

      const index = pickHand(
        entry.result,
        state.hand
      );
      const points = index >= 0
        ? toPoints(
          entry.result.landmarks[ index ],
          state.layout,
          state.flip
        )
        : null;

      if ( points ) {
        state.latest = points;
        state.latestAt = entry.updatedAt;
      } else if ( performance.now() - state.latestAt > 400 ) {
        state.latest = null;
      }

      if ( !state.recording ) {
        return;
      }

      if ( !points ) {
        if ( state.samples.length > 0 ) {
          state.dropouts++;
        }

        return;
      }

      if ( state.samples.length === 0 ) {
        // The take's clock starts on its first tracked hand, not on the key
        // press, so a slow first detection doesn't pad the head with nothing.
        state.t0 = entry.updatedAt;
        state.handedness = handednessOf(
          entry.result,
          index
        );
      }

      state.samples.push( {
        t: ( entry.updatedAt - state.t0 ) / 1000,
        points
      } );
    },

    /**
     * End the take and hand it back: `{ samples, layout, handedness, aspect,
     * recordedAt, dropouts }` — feed `samples` and the metadata to
     * `bakeHandClip()`.
     */
    stop() {
      state.recording = false;

      const size = mediapipe.capture?.size ?? {
        width: 4,
        height: 3
      };

      return {
        samples: state.samples,
        layout: state.layout,
        handedness: state.handedness,
        aspect: size.width / size.height,
        recordedAt: new Date().toISOString(),
        dropouts: state.dropouts
      };
    },

    /** Forget everything (sketch restart). */
    clear() {
      state.recording = false;
      state.samples = [];
      state.latest = null;
      state.latestAt = 0;
      state.lastUpdatedAt = 0;
      state.dropouts = 0;
    }
  };
}
