import {
  debug, events, time
} from "./index.js";
import engines from "./engine/index.js";

const sketch = {
  name: location.pathname.split( "/" ).slice(
    1,
    -1
  )
    .join( "-" ),
  engine: undefined,
  setup: (
    setupEngineFunction,
    sketchOptions = {
      engine: "p5js",
      animation: {
        framerate: 60,
        duration: 12
      }
    }
  ) => {
    // persist sketchOptions
    sketch.sketchOptions = sketchOptions;

    // engine system
    const {
      engine = "p5js", ...engineOptions
    } = sketchOptions;

    sketch.engine = engines[ engine ].init(
      engineOptions,
      setupEngineFunction
    );

    // sketch events
    // events.toggleNoLoopOnSingleClick();
    // events.toggleCanvasRecordingOnKey();
    // events.pauseOnSpaceKeyPressed();
    // events.toggleFPSCounterOnKeyPressed();
    // events.toggleFullScreenOnDoubleClick();
    // events.extendCanvasOnResize();

    window.toggleLoop = () => {
      events.handle( "engine-toggle-loop" );
    };

    window.saveCanvas = ( name ) => {
      events.handle(
        "engine-canvas-save",
        name
      );
    };

    window.toggleFPS = () => {
      debug.toggleFPSCounter();
    };
  },
  draw: ( drawFunction ) => {
    events.register(
      "pre-draw",
      debug.fps
    );
    events.register(
      "pre-draw",
      time.incrementElapsedTime
    );
    events.register(
      "draw",
      drawFunction
    );
  },
};

export default sketch;
