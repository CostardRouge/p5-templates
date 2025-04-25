import { sketch, events, debug, animation, time } from './index.js';

const recorder = {
  savedFramesCount: 0,
  recording: false,
  capturer: undefined,
  saveCallback: undefined,
  maximumFrames: undefined,
  createCapturer: () => {
    if (recorder.capturer) {
      return;
    }

    recorder.capturer = new CCapture({
      // format: options.get('recording-format'),
      format: "png",
      quality: "best",
      framerate: sketch.engine.getFrameRate(),
      verbose: false,
      name: sketch.name,
      manualStart: true,
      // workersPath: "libraries/",
    });
  },
  start: (maximumFrames, saveCallback) => {
    if (true === recorder.recording) {
      return;
    }

    if (maximumFrames) {
      if (!document.getElementById('recording-progression')) {
        const progressBar = document.createElement('div')

        progressBar.id = 'recording-progression';

        document.getElementsByTagName('main')[0].prepend(progressBar);
      }
    }

    recorder.createCapturer();
    recorder.capturer.start();

    recorder.recording = true;
    recorder.savedFramesCount = 0;
    recorder.saveCallback = saveCallback;
    recorder.maximumFrames = maximumFrames;

    document.body.classList.add("recording");
  },
  stop: () => {
    recorder.recording = false;
    recorder.saveCallback = undefined;
    recorder.maximumFrames = undefined;

    document.body.classList.remove("recording");

    recorder.capturer.stop();
    recorder.capturer.save( recorder.saveCallback );
  },
  onDraw: async() => {
    requestAnimationFrame(recorder.onDraw);

    if (undefined === recorder.capturer) {
      return;
    }

    if (true !== recorder.recording) {
      return;
    }

    debug.createElement( "body", "recorder-saved-frames", () => {
      if (recorder.maximumFrames) {
        return `${recorder.savedFramesCount} / ${recorder.maximumFrames}`
      }

      return recorder.savedFramesCount;
    }, !recorder.recording)

    if (recorder.maximumFrames && document.getElementById('recording-progression')) {
      document.getElementById('recording-progression').style.width = (recorder.savedFramesCount / recorder.maximumFrames) * 100 + '%';
    }

    if (recorder.maximumFrames === recorder.savedFramesCount) {
      recorder.stop();
      return;
    }

    if (recorder.maximumFrames && recorder.savedFramesCount === 0) {
      time.reset();
      redraw();
    }

    recorder.captureFrame();
  },
  captureFrame: () => {
    const canvasElement = sketch?.engine?.getCanvasElement();

    if (undefined === canvasElement) {
      return;
    }

    recorder.capturer.capture(canvasElement);
    recorder.savedFramesCount++;
  }
};

// recorder.onDraw();
// events.register("draw", recorder.onDraw);

requestAnimationFrame(recorder.onDraw);

window.recorder = recorder;
window.startLoopRecording = () => recorder.start(animation.maximumFramesCount);
window.startLoopRecordingWithSaveCallback = saveCallback => recorder.start(animation.maximumFramesCount, saveCallback);

export default recorder;
