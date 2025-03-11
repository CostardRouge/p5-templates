import { sketch, events, debug, animation, time } from './index.js';

const recorder2 = {
  savedFramesCount: 0,
  recording: false,
  capturer: undefined,
  createCapturer: () => {
    if (recorder2.capturer) {
      return;
    }

    recorder2.capturer = new CCapture({
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
  start: (maximumFrames) => {
    if (true === recorder2.recording) {
      return;
    }

    if (maximumFrames) {
      if (!document.getElementById('recording-progression')) {
        const progressBar = document.createElement('div')

        progressBar.id = 'recording-progression';

        document.getElementsByTagName('main')[0].prepend(progressBar);
      }
    }

    recorder2.createCapturer();
    recorder2.capturer.start();

    recorder2.maximumFrames = maximumFrames;
    recorder2.savedFramesCount = 0;
    recorder2.recording = true;

    document.body.classList.add("recording");
  },
  stop: () => {
    recorder2.recording = false;
    recorder2.readyToRecord = false;
    recorder2.maximumFrames = undefined;

    document.body.classList.remove("recording");

    recorder2.capturer.stop();
    recorder2.capturer.save();


  },
  onDraw: async() => {
    requestAnimationFrame(recorder2.onDraw);

    if (undefined === recorder2.capturer) {
      return;
    }

    if (true !== recorder2.recording) {
      return;
    }

    debug.createElement( "body", "recorder-saved-frames", () => {
      if (recorder2.maximumFrames) {
        return `${recorder2.savedFramesCount} / ${recorder2.maximumFrames}`
      }

      return recorder2.savedFramesCount;
    }, !recorder2.recording)

    if (recorder2.maximumFrames && document.getElementById('recording-progression')) {
      document.getElementById('recording-progression').style.width = (recorder2.savedFramesCount / recorder2.maximumFrames) * 100 + '%';
    }

    if (recorder2.maximumFrames === recorder2.savedFramesCount) {
      recorder2.stop();
      return;
    }

    if (recorder2.maximumFrames && recorder2.savedFramesCount === 0) {
      time.reset();
      console.log("time.reset, redraw");
    }

    recorder2.readyToRecord = true;
  },
  captureFrame: () => {
    if (!recorder2.readyToRecord) {
      return;
    }

    const canvasElement = sketch?.engine?.getCanvasElement();

    if (undefined === canvasElement) {
      return;
    }

    console.log('captureFrame');
    recorder2.capturer.capture(canvasElement);
    recorder2.savedFramesCount++;
  },
  readyToRecord: false
};

recorder2.onDraw();

window.startLoopRecording = () => recorder2.start(animation.maximumFramesCount);

export default recorder2;
