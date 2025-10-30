import engines from "./engine/index.js";

import time from "./time.js";
import debug from "./debug.js";
import events from "./events.js";
import slides from "./slides/index";
import options from "./options";

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
      size: {
        width: options.size.width,
        height: options.size.height,
      },
      animation: {
        framerate: options.animation.framerate ?? 60,
        duration: options.animation.duration ?? 12,
      }
    }
  ) => {
    sketch.sketchOptions = sketchOptions;

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

    slides.registerEvents();
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
