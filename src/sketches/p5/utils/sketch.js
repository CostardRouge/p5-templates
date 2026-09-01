import time from "./time.js";
import debug from "./debug.js";
import events from "./events.js";
import slides from "./slides/index";
import options, {
  registerEvents as registerOptionsEvents,
  disposeInteractionOnReset
} from "./options";
import {
  registerAnimationBridge
} from "@/lib/animationBridge";
import {
  reportAssetLoading
} from "@/lib/assets/loadingProgress";
import {
  pauseLoop, resumeLoop
} from "./loopControl.js";
import loadProfiler from "./loadProfiler.js";
import {
  coerceFramerate
} from "./framerate.js";
import {
  resolveAnimation
} from "@/lib/animationConfig";

let _p5 = null;
let _container = null;
let _p5ClassPromise = null;

// ---- nested-sketch surface override ---------------------------------
// A "sketch" content item runs ANOTHER sketch as a layer, into its own p5
// graphics buffer (see ./nestedSketch.js). Sketch code and every helper under
// @/p5/utils/ reach the drawing surface through getP5() and nothing else, so
// swapping what getP5() returns for the duration of the embedded draw is the
// single lever that redirects a whole sketch — its own draw, the shared grid /
// colors / shapes helpers, everything — onto the buffer. Nothing else has to
// know embedding exists.
//
// The override is a stack (embedding is allowed to nest) and is always
// restored in a `finally`: leaking it would send the host's own draw into a
// dead buffer, which looks like a sketch that silently stopped rendering.
let _surfaceOverride = null;

export function setP5( instance ) {
  _p5 = instance;
}

export function getP5() {
  return _surfaceOverride ?? _p5;
}

/** The real p5 instance, ignoring any embedded-sketch surface override. */
export function getHostP5() {
  return _p5;
}

/** Redirect getP5() at `surface`; returns the previous override to restore. */
export function pushSurfaceOverride( surface ) {
  const previous = _surfaceOverride;

  _surfaceOverride = surface ?? null;

  return previous;
}

export function popSurfaceOverride( previous ) {
  _surfaceOverride = previous ?? null;
}

export function getSurfaceOverride() {
  return _surfaceOverride;
}

// ---- sketch-module registration capture ------------------------------
// Importing a sketch module runs its top level, which calls sketch.setup() and
// sketch.draw() on THIS singleton — fine for the page's own sketch, fatal for
// an embedded one, which would overwrite the host's callbacks mid-run. While a
// capture is open both setters write into it instead, so the host is untouched
// and the embedded sketch's functions come back addressable.
let _capture = null;

export function beginSketchCapture() {
  _capture = {
    setupFn: null,
    drawFn: null,
    sketchOptions: undefined
  };

  return _capture;
}

export function endSketchCapture() {
  const captured = _capture;

  _capture = null;

  return captured;
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
    _p5ClassPromise = reportAssetLoading(
      "module",
      "p5",
      import( "p5/lib/p5.js" ).then( ( module ) => {
        const P5 = module?.default ?? globalThis.p5 ?? module;

        if ( !P5 ) {
          throw new Error( "Failed to load p5 constructor." );
        }

        return P5;
      } )
    );
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
    purple: undefined
  },

  // ---- public API (called by sketch modules) --------------------------

  setup: (
    setupEngineFunction, sketchOptions
  ) => {
    const size = options.size ?? {
      width: 1080,
      height: 1350
    };
    const animation = options.animation ?? {
      framerate: 60,
      duration: 12
    };

    sketchOptions = Object.assign(
      {
        size: {
          width: size.width,
          height: size.height
        },
        animation: {
          framerate: animation.framerate ?? 60,
          duration: animation.duration ?? 12
        }
      },
      sketchOptions
    );

    const setupFn = typeof setupEngineFunction === "function"
      ? setupEngineFunction
      : null;

    // An embedded sketch's registration is captured, never installed — see
    // beginSketchCapture above.
    if ( _capture ) {
      _capture.sketchOptions = sketchOptions;
      _capture.setupFn = setupFn;
      return;
    }

    sketch.sketchOptions = sketchOptions;
    sketch._setupFn = setupFn;
  },

  draw: ( drawFunction ) => {
    if ( _capture ) {
      _capture.drawFn = drawFunction;
      return;
    }

    sketch._drawFn = drawFunction;
  },

  // ---- start (called by P5Engine.ts after sketch module import) -------

  start: async( container ) => {
    loadProfiler.markSketchStart( sketch.name );

    const p5 = await loadP5Class();

    // This module is a singleton, so it can only ever run ONE p5 instance. A
    // previous run may still be live if its engine was torn down mid-init
    // (e.g. a React strict-mode double-mount racing destroy against a pending
    // start): letting a second instance boot would stack a second canvas in
    // the container, double every registered event handler (the draw clock
    // would advance twice per frame) and leave capture reading the dead
    // surface. Replace the leftover instead — remove() tears its canvas and
    // loop down — and clear the event registry its run registered into.
    const previous = getP5();

    if ( previous ) {
      previous.remove();
      setP5( null );
      events.registeredEvents = {};
    }

    setContainer( container );

    const sketchOptions = sketch.sketchOptions ?? {
      size: {
        width: 1080,
        height: 1350
      },
      animation: {
        framerate: 60,
        duration: 12
      }
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

    // Re-register options module handlers (they were module-level before,
    // but reset() clears registeredEvents so they must be re-registered here).
    registerOptionsEvents();

    // Create the p5 instance in instance mode
    new p5(
      ( p ) => {
        setP5( p );

        p.preload = () => {
          events.handle( "engine-window-preload" );
        };

        p.setup = async() => {
          loadProfiler.markSetupBegin();

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
              ratio
            } = {}
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

          p.frameRate( coerceFramerate( sketchOptions?.animation?.framerate ) ?? 60 );
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

          // pre-setup ran initializeOptionsSubscription, which resolved the
          // *effective* animation (per-slide override, persisted job) into
          // sketch.sketchOptions — the frameRate call above only saw the
          // module snapshot. Re-apply so the loop boots on the effective
          // rate instead of waiting for the next framerate-change event.
          const effectiveFramerate = coerceFramerate( sketch.sketchOptions?.animation?.framerate );

          if ( effectiveFramerate !== null ) {
            p.frameRate( effectiveFramerate );
          }

          // -- setup (user function) ------------------------------------
          p.noStroke();
          p.pixelDensity( 1 );

          await sketch._setupFn?.( {
            center: sketch.getCanvasCenter(),
            canvas: sketch.canvas,
            p
          } );
          events.handle( "setup" );

          // -- post-setup -----------------------------------------------
          events.handle( "post-setup" );

          loadProfiler.markSetupEnd();
        };

        p.draw = async() => {
          const drawStartedAt = performance.now();

          events.handle( "pre-draw" );

          // Call the user's draw function. The first arg is the duration-scaled
          // loop clock (time.drawSeconds), NOT raw elapsed seconds: a sketch
          // that animates off it completes its whole loop within `duration`, so
          // changing the duration rescales the live preview and the recording
          // identically. At the default duration it equals the old real-seconds
          // value, so existing sketches are unchanged there.
          await sketch._drawFn?.(
            time.drawSeconds(),
            sketch.getCanvasCenter(),
            sketch.favoriteColors.purple,
            p
          );

          events.handle( "post-draw" );

          // Diagnostic: per-frame main-thread work + frame gap over the first
          // couple of seconds, logged once (see loadProfiler).
          loadProfiler.recordFrame( performance.now() - drawStartedAt );
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
    // Embedded-sketch layers hold a graphics buffer (and a hidden canvas
    // element) each. nestedSketch.js installs this when it loads; a static
    // import here would make the core runtime depend on the embedding feature.
    sketch.disposeNestedSketches?.();

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
    events.registeredEvents = {};

    // Reset animation time so the next sketch starts at t=0
    time.reset();

    // Release the interaction handler's camera/mic/listeners before the next
    // sketch loads (engine-managed teardown; fixes a pre-existing leak where
    // reset never disposed interaction).
    disposeInteractionOnReset();

    // Drop the interaction vision-readiness hook between sketches; interaction
    // sketches re-publish it from initInteraction().
    if ( typeof window !== "undefined" ) {
      delete window.isInteractionVisionReady;
    }
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

    if ( !p ) {
      return {
        x: 0,
        y: 0
      };
    }

    // While an embedded sketch is drawing, "the canvas" is its buffer: its own
    // dimensions (p.width/p.height already follow the override) and its own
    // renderer mode. Reading sketch.canvas here would hand a WEBGL layer the
    // host's 2D centre, and every sketch that lays out from `center` would draw
    // a quarter-canvas off.
    const surface = getSurfaceOverride();
    const isP3D = surface
      ? Boolean( surface._renderer?.isP3D )
      : Boolean( sketch.canvas?.isP3D );

    if ( isP3D ) {
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
        if ( subscribers.size === 0 ) {
          return;
        }

        // Read the single canonical loop phase (same source as
        // animation.progression and the draw clock) so subscribers never see a
        // position that disagrees with the running sketch.
        subscribers.forEach( ( cb ) => cb( time.phase() ) );
      }
    );

    registerAnimationBridge( {
      getProgression: () => time.phase(),

      setProgression: ( value ) => {
        const clamped = Math.max(
          0,
          Math.min(
            1,
            value
          )
        );
        const {
          duration
        } = resolveAnimation( sketch.sketchOptions?.animation );

        time.elapsed = clamped * duration * 1000;

        try {
          const now = sketch.getElapsedTime();

          if ( typeof now === "number" ) {
            time.lastUpdate = now;
          }
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
      }
    } );
  },

  // ---- event handlers -------------------------------------------------

  eventHandlers: {
    "engine-toggle-loop": () => {
      sketch.paused = sketch.paused ?? false;
      sketch.paused = !sketch.paused;

      if ( sketch.paused ) {
        pauseLoop( getP5() );
      } else {
        resumeLoop( getP5() );
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
    "engine-pause": () => pauseLoop( getP5() ),
    "engine-resume": () => resumeLoop( getP5() ),
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
      const framerate = coerceFramerate( value );

      if ( framerate !== null ) {
        getP5()?.frameRate( framerate );
      }
    }
  }
};

export default sketch;
