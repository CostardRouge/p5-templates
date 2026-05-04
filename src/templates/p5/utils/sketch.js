import time from "./time.js";
import debug from "./debug.js";
import events from "./events.js";
import slides from "./slides/index";
import options from "./options";
import {
  registerAnimationBridge
} from "@/lib/animationBridge";

let _p5 = null;
let _container = null;
let _p5ClassPromise = null;

export function setP5( instance ) {
  _p5 = instance;
}

export function getP5() {
  return _p5;
}

export function setContainer( el ) {
  _container = el;
}

export function getContainer() {
  return _container;
}

export async function loadP5Class() {
  if ( typeof globalThis !== "undefined" && globalThis.p5 ) {
    return globalThis.p5;
  }

  if ( !_p5ClassPromise ) {
    _p5ClassPromise = import( "p5/lib/p5.js" ).then( ( module ) => {
      const P5 = module?.default ?? globalThis.p5 ?? module;

      if ( !P5 ) {
        throw new Error( "Failed to load p5 constructor." );
      }

      return P5;
    } );
  }

  return _p5ClassPromise;
}

const sketch = {
  name: typeof location !== "undefined"
    ? location.pathname.split( "/" ).slice(
      1,
      -1
    )
      .join( "-" )
    : "",

  // ---- stored sketch functions (set by sketch modules) ----------------
  _setupFn: null,
  _drawFn: null,

  // ---- engine state (previously in engine/p5.js) ----------------------
  engine: undefined,
  canvas: undefined,
  camera: undefined,
  paused: false,
  sketchOptions: undefined,
  favoriteColors: {
    purple: undefined,
  },

  // ---- public API (called by sketch modules) --------------------------

  setup: (
    setupEngineFunction, sketchOptions
  ) => {
    const size = options.size ?? {
      width: 1080,
      height: 1350,
    };
    const animation = options.animation ?? {
      framerate: 60,
      duration: 12,
    };

    sketchOptions = Object.assign(
      {
        size: {
          width: size.width,
          height: size.height,
        },
        animation: {
          framerate: animation.framerate ?? 60,
          duration: animation.duration ?? 12,
        },
      },
      sketchOptions
    );
    sketch.sketchOptions = sketchOptions;
    sketch._setupFn = typeof setupEngineFunction === "function"
      ? setupEngineFunction
      : null;
  },

  draw: ( drawFunction ) => {
    sketch._drawFn = drawFunction;
  },

  // ---- start (called by P5Engine.ts after sketch module import) -------

  start: async( container ) => {
    const p5 = await loadP5Class();

    setContainer( container );

    const sketchOptions = sketch.sketchOptions ?? {
      size: {
        width: 1080,
        height: 1350,
      },
      animation: {
        framerate: 60,
        duration: 12,
      },
    };

    // backward compat: sketch.engine points to sketch itself
    sketch.engine = sketch;

    // Register event handlers
    Object.entries( sketch.eventHandlers ).forEach( ( [
      eventName,
      eventHandler
    ] ) => {
      events.register(
        eventName,
        eventHandler
      );
    } );

    // Register pre-draw handlers
    events.register(
      "pre-draw",
      time.incrementElapsedTime
    );
    // Register post-draw handlers
    events.register(
      "post-draw",
      debug.fps
    );

    // Create the p5 instance in instance mode
    new p5(
      ( p ) => {
        setP5( p );

        p.preload = () => {
          events.handle( "engine-window-preload" );
        };

        p.setup = async() => {
          // -- pre-setup ------------------------------------------------
          sketch.favoriteColors.purple = p.color(
            128,
            128,
            255
          );

          const {
            type = "p2d",
            size: {
              width = 1080,
              height = 1350,
              ratio,
            } = {
            },
          } = sketchOptions;

          sketch.canvas = p.createCanvas(
            width,
            ratio ? width / ratio : height,
            type
          );

          if ( "webgl" === type ) {
            sketch.camera = p.createCamera();
            p.setCamera( sketch.camera );
          }

          p.frameRate( sketchOptions?.animation?.framerate );
          p.smooth();

          // Canvas-level event handlers
          sketch.canvas.doubleClicked( ( event ) => {
            events.handle(
              "engine-canvas-double-clicked",
              event
            );
          } );

          sketch.canvas.mousePressed( ( event ) => {
            events.handle(
              "engine-canvas-mouse-pressed",
              event
            );
          } );

          if ( typeof sketch.canvas.mouseClicked === "function" ) {
            sketch.canvas.mouseClicked( ( event ) => {
              events.handle(
                "engine-canvas-mouse-clicked",
                event
              );
            } );
          }

          if ( typeof sketch.canvas.touchStarted === "function" ) {
            sketch.canvas.touchStarted( ( event ) => {
              events.handle(
                "engine-canvas-touch-started",
                event
              );
            } );
          }

          sketch.canvas.drop(
            ( file ) => {
              events.handle(
                "engine-canvas-handle-file",
                file
              );
            },
            ( event ) => {
              events.handle(
                "engine-canvas-handle-drop",
                event
              );
            }
          );

          events.handle( "pre-setup" );

          // -- setup (user function) ------------------------------------
          p.noStroke();
          p.pixelDensity( 1 );

          await sketch._setupFn?.( {
            center: sketch.getCanvasCenter(),
            canvas: sketch.canvas,
            p,
          } );
          events.handle( "setup" );

          // -- post-setup -----------------------------------------------
          events.handle( "post-setup" );
        };

        p.draw = async() => {
          events.handle( "pre-draw" );

          // Call the user's draw function with the same args as before
          await sketch._drawFn?.(
            time.seconds(),
            sketch.getCanvasCenter(),
            sketch.favoriteColors.purple,
            p
          );

          events.handle( "post-draw" );
        };

        // Keyboard
        p.keyTyped = ( event ) => {
          events.handle(
            "engine-on-key-typed",
            event
          );
        };
        p.keyPressed = ( event ) => {
          events.handle(
            "engine-key-pressed",
            event
          );
        };

        // Mouse
        p.mousePressed = ( event ) => {
          events.handle(
            "engine-mouse-pressed",
            event
          );
        };
        p.mouseClicked = ( event ) => {
          events.handle(
            "engine-mouse-clicked",
            event
          );
        };
        p.mouseDragged = ( event ) => {
          events.handle(
            "engine-mouse-dragged",
            event
          );
        };
        p.mouseReleased = ( event ) => {
          events.handle(
            "engine-mouse-released",
            event
          );
        };
        p.doubleClicked = ( event ) => {
          events.handle(
            "engine-window-double-click",
            event
          );
        };

        // Touch
        p.touchStarted = ( event ) => {
          events.handle(
            "engine-touch-started",
            event
          );
        };
        p.touchMoved = ( event ) => {
          events.handle(
            "engine-touch-moved",
            event
          );
        };
        p.touchEnded = ( event ) => {
          events.handle(
            "engine-touch-ended",
            event
          );
        };

        // Window
        p.windowResized = ( event ) => {
          events.handle(
            "engine-window-resized",
            event
          );
        };
      },
      container
    );

    // Global helpers
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

    // register engine-agnostic animation bridge
    sketch.registerBridge();

    return sketch;
  },

  // ---- reset (called by P5Engine.ts on destroy) -----------------------

  reset: () => {
    setP5( null );
    setContainer( null );
    sketch._setupFn = null;
    sketch._drawFn = null;
    sketch.canvas = undefined;
    sketch.camera = undefined;
    sketch.paused = false;
    sketch.sketchOptions = undefined;
    sketch.engine = undefined;

    // Clear all registered events so the next sketch starts fresh
    events.registeredEvents = {
    };
  },

  // ---- engine methods (backward compat for time.js, debug.js, etc.) ---

  setP5,
  getP5,
  setContainer,
  getContainer,

  getCanvasElement: () => {
    const p = getP5();

    return sketch.canvas?.elt ?? p?._renderer?.elt;
  },
  getFrameCount: () => getP5()?.frameCount ?? 0,
  getFrameRate: () => getP5()?.frameRate() ?? 0,
  getElapsedTime: () => getP5()?.millis() ?? 0,
  getCanvasCenter: () => {
    const p = getP5();

    if ( !p ) return {
      x: 0,
      y: 0
    };

    if ( sketch.canvas?.isP3D ) {
      return p.createVector(
        0,
        0
      );
    }

    return p.createVector(
      p.width / 2,
      p.height / 2
    );
  },

  // ---- animation bridge -----------------------------------------------

  registerBridge: () => {
    const subscribers = new Set();

    events.register(
      "post-draw",
      () => {
        if ( subscribers.size === 0 ) return;

        const duration = sketch.sketchOptions?.animation?.duration || 10;
        const seconds = time.seconds();
        const progression = time.isRecording
          ? Math.min(
            seconds / duration,
            1.0
          )
          : ( seconds % duration ) / duration;

        subscribers.forEach( ( cb ) => cb( progression ) );
      }
    );

    registerAnimationBridge( {
      getProgression: () => {
        const duration = sketch.sketchOptions?.animation?.duration || 10;
        const seconds = time.seconds();

        return time.isRecording
          ? Math.min(
            seconds / duration,
            1.0
          )
          : ( seconds % duration ) / duration;
      },

      setProgression: ( value ) => {
        const clamped = Math.max(
          0,
          Math.min(
            1,
            value
          )
        );
        const duration = sketch.sketchOptions?.animation?.duration || 10;

        time.elapsed = clamped * duration * 1000;

        try {
          const now = sketch.getElapsedTime();

          if ( typeof now === "number" ) time.lastUpdate = now;
        } catch {
          // p5 millis() may not be available before the first draw.
        }
      },

      pause: () => events.handle( "engine-pause" ),
      resume: () => events.handle( "engine-resume" ),
      redraw: () => events.handle( "engine-redraw" ),

      subscribe: ( cb ) => {
        subscribers.add( cb );

        return () => subscribers.delete( cb );
      },
    } );
  },

  // ---- event handlers -------------------------------------------------

  eventHandlers: {
    "engine-toggle-loop": () => {
      sketch.paused = sketch.paused ?? false;
      sketch.paused = !sketch.paused;

      if ( sketch.paused ) {
        getP5()?.noLoop();
      } else {
        getP5()?.loop();
      }
    },
    "engine-get-key-typed": () => getP5()?.key,
    "engine-toggle-fullscreen": () => {
      const p = getP5();

      p?.fullscreen( !p?.fullscreen() );
    },
    "engine-fill-screen": () => {
      const p = getP5();

      events.handle(
        "engine-resize-canvas",
        p?.windowWidth,
        p?.windowHeight
      );
    },
    "engine-resize-canvas": (
      canvasWidth, canvasHeight
    ) => {
      sketch.canvas?.resize(
        canvasWidth,
        canvasHeight
      );
      events.handle(
        "engine-resized-canvas",
        canvasWidth,
        canvasHeight
      );
    },
    "engine-fullscreen-toggle": () => {
      const p = getP5();

      p?.fullscreen( !p?.fullscreen() );
    },
    "engine-pause": () => getP5()?.noLoop(),
    "engine-resume": () => getP5()?.loop(),
    "engine-redraw": () => getP5()?.redraw(),
    "engine-canvas-save": (
      name, type
    ) => {
      const p = getP5();

      p?.saveCanvas(
        sketch.canvas,
        name,
        type
      );
    },
    "engine-smooth-pixel-change": ( checked ) =>
      checked ? getP5()?.smooth() : getP5()?.noSmooth(),
    "engine-framerate-change": ( value ) => {
      getP5()?.frameRate( value );
    },
  },
};

export default sketch;
