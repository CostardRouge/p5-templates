import events from "@/p5/utils/events.js";
import scripts from "@/p5/utils/scripts.js";
import time from "@/p5/utils/time.js";
import { registerAnimationBridge } from "@/lib/animationBridge";

const p5js = {
  camera: undefined,
  canvas: undefined,
  paused: false,
  favoriteColors: {
    purple: undefined,
  },
  init: (sketchOptions, setupEngineFunction) => {
    p5js.sketchOptions = sketchOptions;

    // scripts
    p5js.loadScripts();

    // global functions
    p5js.attachGlobalFunctions();

    // setup (using events)
    p5js.setup(sketchOptions, setupEngineFunction);

    // register engine-agnostic animation bridge
    p5js.registerBridge();

    return p5js;
  },
  getCanvasElement: () => p5js.canvas.elt,
  getFrameCount: () => frameCount,
  getFrameRate: () => frameRate(),
  getElapsedTime: () => millis(),
  loadScripts: async () => {
    await scripts.load("/assets/libraries/p5.min.js");
    // await scripts.load("/assets/libraries/q5.js");
  },
  attachGlobalFunctions: () => {
    window.setup = () => {
      events.handle("pre-setup");
      events.handle("setup");
      events.handle("post-setup");
    };
    window.draw = () => {
      events.handle("pre-draw");
      events.handle(
        "draw",
        time.seconds(),
        p5js.getCanvasCenter(),
        p5js.favoriteColors.purple
      );
      events.handle("post-draw");
    };
    window.keyTyped = (event) => {
      events.handle("engine-on-key-typed", event);
    };
    window.keyPressed = (event) => {
      events.handle("engine-key-pressed", event);
    };
    window.mousePressed = (event) => {
      events.handle("engine-mouse-pressed", event);
    };
    window.mouseClicked = (event) => {
      events.handle("engine-mouse-clicked", event);
    };
    window.mouseDragged = (event) => {
      events.handle("engine-mouse-dragged", event);
    };
    window.mouseReleased = (event) => {
      events.handle("engine-mouse-released", event);
    };
    window.doubleClicked = (event) => {
      events.handle("engine-window-double-click", event);
    };
    window.touchStarted = (event) => {
      events.handle("engine-touch-started", event);
    };
    window.touchMoved = (event) => {
      events.handle("engine-touch-moved", event);
    };
    window.touchEnded = (event) => {
      events.handle("engine-touch-ended", event);
    };
    window.touchMoved = (event) => {
      events.handle("engine-touch-moved", event);
    };
    window.touchEnded = (event) => {
      events.handle("engine-touch-ended", event);
    };
    window.windowResized = (event) => {
      events.handle("engine-window-resized", event);
    };
    window.preload = (event) => {
      events.handle("engine-window-preload", event);
    };
  },
  setup: (sketchOptions, setupEngineFunction) => {
    events.register("pre-setup", () => {
      // init favorite colors
      p5js.favoriteColors.purple = color(128, 128, 255);

      // canvas creation
      const {
        type = "p2d",
        size: {
          width = 1080,
          height = 1350,
          ratio,
        } = {},
      } = sketchOptions;

      p5js.canvas = createCanvas(width, ratio ? width / ratio : height, type);

      if ("webgl" === type) {
        p5js.camera = createCamera();
        setCamera(p5js.camera);
      }

      // applying options
      frameRate(sketchOptions?.animation?.framerate);

      smooth();

      // registering events
      Object.entries(p5js.eventHandlers).forEach(
        ([eventName, eventHandler]) => {
          events.register(eventName, eventHandler);
        }
      );

      p5js.canvas.doubleClicked((event) => {
        events.handle("engine-canvas-double-clicked", event);
      });

      p5js.canvas.mousePressed((event) => {
        events.handle("engine-canvas-mouse-pressed", event);
      });

      if (typeof p5js.canvas.mouseClicked === "function") {
        p5js.canvas.mouseClicked((event) => {
          events.handle("engine-canvas-mouse-clicked", event);
        });
      }

      if (typeof p5js.canvas.touchStarted === "function") {
        p5js.canvas.touchStarted((event) => {
          events.handle("engine-canvas-touch-started", event);
        });
      }

      p5js.canvas.drop(
        (file) => {
          events.handle("engine-canvas-handle-file", file);
        },
        (event) => {
          events.handle("engine-canvas-handle-drop", event);
        }
      );
    });

    events.register("setup", () => {
      noStroke();
      pixelDensity(1);
      setupEngineFunction?.({
        center: p5js.getCanvasCenter(),
        canvas: p5js.canvas,
      });
    });
  },
  getCanvasCenter: () => {
    if (p5js.canvas.isP3D) {
      return createVector(0, 0);
    }

    return createVector(width / 2, height / 2);
  },
  /**
   * Registers this engine's AnimationBridge implementation.
   * Computes progression from `time` so that all engines sharing the
   * same time module stay in sync without extra coupling.
   */
  registerBridge: () => {
    const subscribers = new Set();

    // Push progression to all subscribers once per draw frame.
    events.register("post-draw", () => {
      if ( subscribers.size === 0 ) return;

      const duration = p5js.sketchOptions?.animation?.duration || 10;
      const seconds = time.seconds();
      const progression = time.isRecording
        ? Math.min( seconds / duration, 1.0 )
        : ( seconds % duration ) / duration;

      subscribers.forEach( ( cb ) => cb( progression ) );
    } );

    registerAnimationBridge( {
      getProgression: () => {
        const duration = p5js.sketchOptions?.animation?.duration || 10;
        const seconds = time.seconds();

        return time.isRecording
          ? Math.min( seconds / duration, 1.0 )
          : ( seconds % duration ) / duration;
      },

      setProgression: ( value ) => {
        const clamped = Math.max( 0, Math.min( 1, value ) );
        const duration = p5js.sketchOptions?.animation?.duration || 10;

        time.elapsed = clamped * duration * 1000;

        try {
          const now = p5js.getElapsedTime();

          if ( typeof now === "number" ) time.lastUpdate = now;
        } catch {
          // p5 millis() may not be available before the first draw.
        }
      },

      pause:  () => events.handle( "engine-pause" ),
      resume: () => events.handle( "engine-resume" ),
      redraw: () => events.handle( "engine-redraw" ),

      subscribe: ( cb ) => {
        subscribers.add( cb );

        return () => subscribers.delete( cb );
      },
    } );
  },

  eventHandlers: {
    "engine-toggle-loop": () => {
      p5js.paused = p5js.paused ?? false;
      p5js.paused = !p5js.paused;

      if (p5js.paused) {
        noLoop();
      } else {
        loop();
      }
    },
    "engine-get-key-typed": () => key,
    "engine-toggle-fullscreen": () => fullscreen(!fullscreen()),
    "engine-fill-screen": () =>
      events.handle("engine-resize-canvas", windowWidth, windowHeight),
    "engine-resize-canvas": (canvasWidth, canvasHeight) => {
      p5js.canvas.resize(canvasWidth, canvasHeight);
      events.handle("engine-resized-canvas", canvasWidth, canvasHeight);
    },
    "engine-fullscreen-toggle": () => fullscreen(!fullscreen()),
    "engine-pause": () => noLoop(),
    "engine-resume": () => loop(),
    "engine-redraw": () => redraw(),
    "engine-canvas-save": (name, type) => saveCanvas(p5js.canvas, name, type),
    "engine-smooth-pixel-change": (checked) =>
      checked ? smooth() : noSmooth(),
    "engine-framerate-change": (value) => {
      frameRate(value);
    },
  },
};

export default p5js;
