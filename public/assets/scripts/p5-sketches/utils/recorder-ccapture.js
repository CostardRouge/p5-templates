import {
  sketch, events, debug, animation, time, scripts, captureOptions as options
} from "./index.js";

const recorder = {
  savedFramesCount: 0,
  recording: false,
  lib: undefined,
  saveCallback: undefined,
  maximumFrames: undefined,
  load: async() => {
    if ( recorder.lib ) {
      return;
    }

    await scripts.load( "/assets/libraries/CCapture.all.min.js" );

    recorder.lib = new CCapture( {
      // format: options.get('recording-format'),
      format: "png",
      quality: "best",
      framerate: sketch.engine.getFrameRate(),
      verbose: false,
      name: options.name || sketch.name,
      manualStart: true,
      workersPath: "libraries/",
    } );
  },
  start: async( maximumFrames, saveCallback ) => {
    if ( true === recorder.recording ) {
      return;
    }

    if ( maximumFrames ) {
      if ( !document.getElementById( "recording-progression" ) ) {
        const progressBar = document.createElement( "div" );

        progressBar.id = "recording-progression";

        document.getElementsByTagName( "main" )[ 0 ].prepend( progressBar );
      }
    }

    await recorder.load();
    recorder.lib.start();

    recorder.recording = true;
    recorder.savedFramesCount = 0;
    recorder.saveCallback = saveCallback;
    recorder.maximumFrames = maximumFrames;

    document.body.classList.add( "recording" );
  },
  stop: () => {
    recorder.recording = false;
    recorder.saveCallback = undefined;
    recorder.maximumFrames = undefined;

    document.body.classList.remove( "recording" );

    recorder.lib.stop();
    recorder.lib.save( recorder.saveCallback );
  },
  onDraw: () => {
    requestAnimationFrame( recorder.onDraw );

    if ( undefined === recorder.lib ) {
      return;
    }

    if ( true !== recorder.recording ) {
      return;
    }

    debug.createElement( "body",
      "recorder-saved-frames",
      () => {
        if ( recorder.maximumFrames ) {
          return `${ recorder.savedFramesCount } / ${ recorder.maximumFrames }`;
        }

        return recorder.savedFramesCount;
      },
      !recorder.recording );

    if ( recorder.maximumFrames && document.getElementById( "recording-progression" ) ) {
      document.getElementById( "recording-progression" ).style.width = ( recorder.savedFramesCount / recorder.maximumFrames ) * 100 + "%";
    }

    if ( recorder.maximumFrames === recorder.savedFramesCount ) {
      recorder.stop();
      return;
    }

    if ( recorder.maximumFrames && recorder.savedFramesCount === 0 ) {
      time.reset();
      redraw();
    }

    recorder.captureFrame();
  },
  captureFrame: () => {
    const canvasElement = sketch?.engine?.getCanvasElement();

    if ( undefined === canvasElement ) {
      return;
    }

    recorder.lib.capture( canvasElement );
    recorder.savedFramesCount++;

    if ( typeof window.reportCaptureProgress === "function" ) {
      const progression = ( recorder.savedFramesCount / animation.maximumFramesCount );

      window.reportCaptureProgress( progression );
    }
  }
};

// recorder.onDraw();
// events.register("draw", recorder.onDraw);

requestAnimationFrame( recorder.onDraw );

window.recorder = recorder;
window.startLoopRecording = async() => recorder.start( animation.maximumFramesCount );
window.startLoopRecordingWithSaveCallback = async saveCallback => recorder.start(
  animation.maximumFramesCount,
  saveCallback
);

export default recorder;
