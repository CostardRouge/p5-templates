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

export default time;
