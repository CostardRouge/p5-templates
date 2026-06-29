import sketch from "./sketch.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";

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
  // Resolve the loop length through the shared resolver (same default as the
  // encode loop) so progression and the recorded frame count never disagree.
  const {
    duration
  } = resolveAnimation( sketch?.sketchOptions?.animation );
  const seconds = time.seconds();

  // During recording, don't wrap and don't cap - progression should match frame count
  if ( time.isRecording ) {
    const progression = seconds / duration;

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
  }

  // Normal playback: wrap around for continuous loop
  const progression = ( seconds % duration ) / duration;

  // Dispatch event only when progression changes significantly
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
