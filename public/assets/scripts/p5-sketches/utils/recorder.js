import { sketch, events, debug, animation, time } from './index.js';

const recorder = {
  savedFramesCount: 0,
  recording: false,
  mediaRecorder: undefined,
  recordedChunks: [],
  stream: undefined,
  maximumFrames: undefined,

  createRecorder: () => {
    const canvasElement = sketch?.engine?.getCanvasElement();

    // Get the media stream from the canvas
    recorder.stream = canvasElement.captureStream(sketch.engine.getFrameRate());

    // Find supported mime type
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    // Create media recorder instance
    recorder.mediaRecorder = new MediaRecorder(recorder.stream, {
      mimeType: mimeType,
      // videoBitsPerSecond: 5000000 // 5 Mbps - adjust as needed
    });

    // Handle data available event
    recorder.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recorder.recordedChunks.push(event.data);
      }
    };

    // Handle recording stop event
    recorder.mediaRecorder.onstop = () => {
      console.log('Recording stopped, processing...');

      // Create a Blob from the recorded chunks
      const blob = new Blob(recorder.recordedChunks, {
        type: 'video/webm'
      });

      // Generate download link
      recorder.downloadVideo(blob);
    };
  },

  downloadVideo: (videoBlob) => {
    // Create a download link
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    // const fileDate = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
    // const fileName = `${sketch.name || 'canvas-recording'}-${fileDate}.webm`;
    const fileName = `output.webm`;

    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);

    // Trigger download
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log(`Recording saved as ${fileName}`);
    }, 100);
  },

  start: (maximumFrames) => {
    if (true === recorder.recording) {
      return;
    }

    if (maximumFrames) {
      if (!document.getElementById('recording-progression')) {
        const progressBar = document.createElement('div');
        progressBar.id = 'recording-progression';
        document.getElementsByTagName('main')[0].prepend(progressBar);
      }
    }

    recorder.createRecorder();

    recorder.recordedChunks = [];
    recorder.maximumFrames = maximumFrames;
    recorder.savedFramesCount = 0;
    recorder.recording = true;

    if (recorder.maximumFrames && recorder.savedFramesCount === 0) {
      time.reset();
      redraw();
      console.log("time.reset");

      // Start the media recorder
      recorder.mediaRecorder.start(16);
    }

    document.body.classList.add("recording");

    console.log('Recording started');
  },

  stop: () => {
    if (!recorder.recording) {
      return;
    }

    recorder.recording = false;
    recorder.maximumFrames = undefined;

    document.body.classList.remove("recording");

    // Stop the media recorder
    if (recorder.mediaRecorder && recorder.mediaRecorder.state !== 'inactive') {
      recorder.mediaRecorder.stop();
    }

    // Clear UI elements
    if (document.getElementById('recording-progression')) {
      document.getElementById('recording-progression').style.width = '0';
    }

    console.log('Recording stopped');
  },

  onDraw: () => {
    // requestAnimationFrame(recorder.onDraw);

    if (true !== recorder.recording) {
      return;
    }

    debug.createElement("body", "recorder-saved-frames", () => {
      if (recorder.maximumFrames) {
        return `${recorder.savedFramesCount} / ${recorder.maximumFrames}`;
      }
      return recorder.savedFramesCount;
    }, !recorder.recording);

    if (recorder.maximumFrames && document.getElementById('recording-progression')) {
      document.getElementById('recording-progression').style.width =
          (recorder.savedFramesCount / recorder.maximumFrames) * 100 + '%';
    }

    if (recorder.maximumFrames === recorder.savedFramesCount) {
      recorder.stop();
    }

    // Count frames and stop if we've reached the maximum
    recorder.savedFramesCount++;
  }
};

// Start the draw loop
// recorder.onDraw();

// Expose recording functions to global scope
window.startLoopRecording = () => recorder.start(animation.maximumFramesCount);
window.stopRecording = () => recorder.stop();

export default recorder;