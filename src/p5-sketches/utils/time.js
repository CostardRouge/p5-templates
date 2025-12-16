import sketch from "./sketch.js";

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
      const framerate = sketch?.sketchOptions?.animation?.framerate || 60;
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
  },
};

// Expose global function for server-side recording control
window.enableRecordingMode = function() {
  time.reset();
  time.isRecording = true;
};

window.disableRecordingMode = function() {
  time.isRecording = false;
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

  // Get animation duration, default to 10 seconds if undefined
  const duration = sketch?.sketchOptions?.animation?.duration || 10;

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
  // Get animation duration, default to 10 seconds if undefined
  const duration = sketch?.sketchOptions?.animation?.duration || 10;
  const seconds = time.seconds();

  // During recording, don't wrap - let it go beyond 1.0
  if ( time.isRecording ) {
    const progression = Math.min(
      seconds / duration,
      1.0
    );

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
