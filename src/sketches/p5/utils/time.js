import sketch from "./sketch.js";
import {
  resolveAnimation, DURATION_DEFAULT
} from "@/lib/animationConfig";

/* ------------------------------------------------------------------ */
/*  Loop-phase override (embedded sketches)                            */
/*                                                                    */
/*  A "sketch" content item runs another sketch as a layer, and that   */
/*  layer can sit somewhere else in the loop than the page does —      */
/*  frozen on one frame, or running with a phase offset. Sketches      */
/*  reach the loop position through `animation.progression` and the    */
/*  `draw( time, … )` argument, and BOTH are derived from `phase()`,   */
/*  so one swap here moves the layer's whole notion of "when" without  */
/*  any sketch knowing it is embedded — the same lever as getP5()'s    */
/*  surface override (sketch.js) and `options.sketch`'s (options.js).  */
/*                                                                    */
/*  Only the loop phase is overridden. `seconds()` / `milliSeconds()`  */
/*  stay the host's wall clock: they are what audio seeking and the    */
/*  debug overlay read, and those are not part of "where this layer is */
/*  in its animation".                                                 */
/* ------------------------------------------------------------------ */

let _phaseOverride = null;

/** Returns the previous override, to hand back to popPhaseOverride. */
export function pushPhaseOverride( phase ) {
  const previous = _phaseOverride;

  _phaseOverride = Number.isFinite( phase ) ? phase : null;

  return previous;
}

export function popPhaseOverride( previous ) {
  _phaseOverride = Number.isFinite( previous ) ? previous : null;
}

const time = {
  elapsed: 0,
  lastUpdate: 0,
  recordingFrameIndex: 0, // For server-side recording
  isRecording: false,
  seconds: function() {
    return time.milliSeconds() / 1000;
  },
  milliSeconds: function() {
    return time.elapsed;
  },
  // The canonical loop phase in [0, 1): how far through one `duration`-long loop
  // we are. This is THE single value the engine derives looping motion from —
  // `animation.progression`, the animation bridge and the per-frame
  // `draw(time, …)` clock all read it, so the live preview, the progression bar
  // and the recorded file can never resolve a different loop position. During
  // deterministic capture `elapsed` is pinned to frame / framerate, so this is
  // exactly frame / totalFrames.
  phase: function() {
    // An embedded sketch layer can be frozen or offset in its own loop; while
    // its draw runs, that is the phase every reader below it must see.
    if ( _phaseOverride !== null ) {
      return _phaseOverride;
    }

    const {
      duration
    } = resolveAnimation( sketch?.sketchOptions?.animation );
    const seconds = time.seconds();

    // During recording we must NOT wrap: progression climbs monotonically with
    // the frame index so the final frame sits just under a full loop.
    return time.isRecording
      ? seconds / duration
      : ( seconds % duration ) / duration;
  },
  // The seconds value handed to every sketch's `draw(time, …)`. It is the loop
  // phase scaled by the baseline duration, so a sketch authored against it
  // completes its WHOLE animation within `duration` — i.e. the duration is the
  // loop's period. Changing the duration therefore rescales the live preview and
  // the recorded clip identically (WYSIWYG). Scaled by DURATION_DEFAULT so that
  // at the default duration this equals the historical real-seconds clock: every
  // existing sketch looks unchanged at the default duration and simply runs
  // faster at a shorter duration / slower at a longer one.
  drawSeconds: function() {
    return time.phase() * DURATION_DEFAULT;
  },
  every: function(
    second, callback
  ) {
    return sketch?.engine?.getFrameCount() % second === 0 && callback();
  },
  reset() {
    time.elapsed = 0;
    time.lastUpdate = 0;
    time.recordingFrameIndex = 0;
  },
  incrementElapsedTime() {
    // During server-side recording, use frame-based time
    if ( time.isRecording ) {
      const {
        framerate
      } = resolveAnimation( sketch?.sketchOptions?.animation );
      const millisecondsPerFrame = 1000 / framerate;

      time.elapsed = time.recordingFrameIndex * millisecondsPerFrame;
      time.recordingFrameIndex++;
      return;
    }

    // Normal operation: use p5.js millis()
    const now = sketch?.engine?.getElapsedTime();

    if ( typeof now === "number" ) {
      const delta = now - time.lastUpdate;

      time.elapsed += delta;
      time.lastUpdate = now;
    }
  }
};

// Expose global function for server-side recording control
window.enableRecordingMode = function() {
  time.reset();
  time.isRecording = true;
};

window.disableRecordingMode = function() {
  time.isRecording = false;
};

// Pin the deterministic recording clock to an explicit frame index. The client
// async-loop recorder and the server capture controller both call this before
// each redraw, so `incrementElapsedTime` derives `elapsed` from this frame
// (frame * millisecondsPerFrame) instead of letting it free-run on the
// auto-incrementing counter. Without an explicit pin the index only
// auto-advances, which silently drifts whenever a frame is drawn more than once
// (reset-to-start, a stray resize/redraw, a re-entered capture) — leaving the
// captured animation out of sync with the encoder's frame timestamps.
window.setRecordingFrame = function( frameIndex ) {
  const index = Math.floor( Number( frameIndex ) );

  time.recordingFrameIndex = Number.isFinite( index ) && index >= 0
    ? index
    : 0;
};

// Expose global functions for animation progression control
window.setAnimationProgression = function( progression ) {
  // Clamp progression to valid range [0, 1]
  const clampedProgression = Math.max(
    0,
    Math.min(
      1,
      progression
    )
  );

  // Resolve the loop length through the shared resolver so a missing/zero
  // duration uses the same default everywhere (encode loop + clock).
  const {
    duration
  } = resolveAnimation( sketch?.sketchOptions?.animation );

  // Convert progression (0-1) to elapsed time in milliseconds
  time.elapsed = clampedProgression * duration * 1000;

  // Update lastUpdate to current time to prevent jumps
  const now = sketch?.engine?.getElapsedTime();

  if ( typeof now === "number" ) {
    time.lastUpdate = now;
  }

  // Dispatch event for reactive updates
  window.dispatchEvent( new CustomEvent(
    "animation-progression-changed",
    {
      detail: {
        progression: clampedProgression
      }
    }
  ) );
};

// Track last dispatched progression to avoid excessive events
let lastDispatchedProgression = -1;

window.getAnimationProgression = function() {
  // Read the canonical loop phase — the same value `animation.progression`, the
  // bridge and the per-frame draw clock use — so every consumer agrees and the
  // recorded frame count can never disagree with the live position. `phase()`
  // already handles the recording branch (no wrap, matches the frame index).
  const progression = time.phase();

  // Dispatch event only when progression changes significantly (every 0.01 or so)
  if ( Math.abs( progression - lastDispatchedProgression ) > 0.01 ) {
    lastDispatchedProgression = progression;
    window.dispatchEvent( new CustomEvent(
      "animation-progression-changed",
      {
        detail: {
          progression
        }
      }
    ) );
  }

  return progression;
};

export default time;
