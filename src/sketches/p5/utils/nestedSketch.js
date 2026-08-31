// ── Running another sketch as a layer ──────────────────────────────────────
//
// The "sketch" content item (SketchLayerItemSchema) embeds a whole other p5
// sketch in the host sketch, the way a "visual" or an "image" item embeds a
// drawing. This module owns everything that makes that possible; the renderer
// (slides/common/drawSlideSketch.js) only asks it for a buffer and blits it.
//
// Three problems had to be solved, and each is solved by one swap rather than
// by teaching sketches about embedding:
//
//  1. **The surface.** Every sketch and every helper under @/p5/utils/ reaches
//     the drawing surface through `getP5()`. So the embedded run is bracketed
//     with `pushSurfaceOverride( buffer )`: its draw, and all the shared
//     helpers it calls, land in a p5.Graphics buffer instead of the host
//     canvas. `p.width` / `p.height` follow the buffer, so a sketch that lays
//     itself out from the canvas size fills the layer, not the page.
//
//  2. **The parameters.** Sketches read `options.sketch`. The run is bracketed
//     with `pushOptionsOverride`, so that read returns the LAYER's own settings
//     — the object the inspector edits — instead of the host page's.
//
//  3. **The registration.** A sketch module registers its callbacks as an
//     import side effect, onto the same singleton the host uses. Importing one
//     mid-run would overwrite the host's own draw. `beginSketchCapture()`
//     redirects those two setters into a capture object instead, and the
//     result is remembered per path in the shared sketchFnCache (ES modules
//     evaluate once, so a second import registers nothing).
//
// What is deliberately NOT swapped: the clock. An embedded sketch reads the
// host's loop phase, so the layer stays in sync with the page and, crucially,
// stays deterministic under headless capture — the whole composition is a pure
// function of the frame index. The per-layer `framerate` is expressed in that
// same loop time (not wall-clock), for the same reason.

import sketch, {
  getHostP5,
  getSurfaceOverride,
  pushSurfaceOverride,
  popSurfaceOverride,
  beginSketchCapture,
  endSketchCapture
} from "./sketch.js";
import {
  pushOptionsOverride, popOptionsOverride
} from "./options.js";
import {
  getSketchFns, hasSketchFns, rememberSketchFns
} from "./sketchFnCache.js";
import time from "./time.js";

// A buffer bigger than this in either axis is refused: an embedded sketch is a
// layer, and a slider slip on "resolution" should not allocate a 16k texture.
const MAX_BUFFER_SIDE = 4096;

// Instances whose layer has not been drawn for this many host frames are torn
// down. A layer that is merely off (eye toggle) or scrolled past on another
// slide keeps its buffer for a moment, so toggling it back is instant.
const IDLE_FRAMES_BEFORE_DISPOSE = 180;

/** key ("<scope>:<index>") → instance record. */
const instances = new Map();

/** Host frame the idle sweep last ran on, so it runs once per frame at most. */
let lastSweepFrame = -1;

/** Sketch paths whose module import is in flight or has failed. */
const loading = new Set();
const failed = new Map();

/* ------------------------------------------------------------------ */
/*  Module loading                                                     */
/* ------------------------------------------------------------------ */

function ensureSketchLoaded( sketchPath ) {
  if ( hasSketchFns( sketchPath ) || loading.has( sketchPath ) || failed.has( sketchPath ) ) {
    return;
  }

  loading.add( sketchPath );

  import( "@/generated/sketchModuleRegistry" )
    .then( ( {
      loadSketchModule
    } ) => {
      // The capture is opened around the import ONLY. It is what keeps the
      // host's own _setupFn/_drawFn intact while the embedded module runs its
      // top level.
      const capture = beginSketchCapture();

      return Promise.resolve( loadSketchModule(
        "p5",
        sketchPath
      ) ).then(
        () => {
          endSketchCapture();
          rememberSketchFns(
            sketchPath,
            capture
          );

          if ( !hasSketchFns( sketchPath ) ) {
            // The module resolved but registered nothing. Either it is not a
            // sketch, or it was already imported earlier in this session AND
            // never cached — which the shared cache is there to prevent, so
            // treat it as a real failure rather than silently drawing nothing.
            throw new Error( `"${ sketchPath }" registered no draw function` );
          }
        },
        ( error ) => {
          endSketchCapture();
          throw error;
        }
      );
    } )
    .catch( ( error ) => {
      failed.set(
        sketchPath,
        error
      );
      console.warn(
        `[nested-sketch] failed to load "${ sketchPath }"`,
        error
      );
    } )
    .finally( () => {
      loading.delete( sketchPath );
    } );
}

/* ------------------------------------------------------------------ */
/*  The buffer proxy                                                   */
/* ------------------------------------------------------------------ */

const NOOP = () => {};

// p5.Graphics copies every p5.prototype method onto itself, bound to itself —
// including the ones that are only meaningful on a real p5 *instance*. They are
// there, they are callable, and they throw: `createGraphics` ends in
// `pInst._elements.push( … )`, and a p5.Graphics has no `_elements` (found as
// "Cannot read properties of undefined (reading 'push')" from
// `graphics.createAutoResizableGraphics`, i.e. from every GPU-helper sketch).
//
// These are routed to the host instead. What they have in common is that they
// need instance state (the element registry, the user node, the preload
// counter) and produce something renderer-INdependent — a buffer, an image, a
// font, a DOM element — which the embedded sketch then uses on its own surface.
//
// Deliberately NOT here: `createShader` / `loadShader` / `createFramebuffer` /
// `createCamera`, which must belong to the buffer's own GL context, and
// `createCanvas`, which no sketch calls (the runtime does) and which on the
// host would replace the page's canvas.
const HOST_METHODS = new Set( [
  "createGraphics",
  "loadImage",
  "loadFont",
  "loadModel",
  "loadStrings",
  "loadJSON",
  "loadXML",
  "loadTable",
  "loadBytes",
  "createCapture",
  "createVideo",
  "createAudio",
  "createImg",
  "createA",
  "createDiv",
  "createP",
  "createSpan",
  "createElement",
  "createInput",
  "createFileInput",
  "createSlider",
  "createButton",
  "createCheckbox",
  "createSelect",
  "createRadio",
  "createColorPicker",
  "select",
  "selectAll",
  "removeElements"
] );

/**
 * What the embedded sketch sees as `p`.
 *
 * A p5.Graphics already carries every p5.prototype method bound to itself, so
 * drawing, maths and colour helpers all work unchanged. What it does NOT carry
 * are the p5 *instance* properties — `frameCount`, `mouseX`, `deltaTime`, the
 * key state — which live on the running instance; those fall through to the
 * host, which is also the honest answer (the pointer is over the host canvas).
 * The methods in HOST_METHODS go the other way: present on the buffer, but
 * broken there, so they are forwarded to the host.
 *
 * `background()` is intercepted rather than filtered at the parameter level:
 * "ignore the sketch's own background" has to hold whether the sketch paints
 * from a `backgroundColor` option, a hard-coded colour or a palette lookup, and
 * the call is the one place all three meet.
 */
function makeSurfaceProxy(
  buffer, host, state
) {
  return new Proxy(
    buffer,
    {
      get(
        target, prop, receiver
      ) {
        if ( prop === "background" && state.suppressBackground ) {
          return NOOP;
        }

        if ( host && HOST_METHODS.has( prop ) && typeof host[ prop ] === "function" ) {
          return host[ prop ].bind( host );
        }

        const value = Reflect.get(
          target,
          prop,
          receiver
        );

        if ( value !== undefined ) {
          return value;
        }

        const fallback = host?.[ prop ];

        return typeof fallback === "function"
          ? fallback.bind( host )
          : fallback;
      },

      has(
        target, prop
      ) {
        return prop in target || Boolean( host && prop in host );
      }
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Instances                                                          */
/* ------------------------------------------------------------------ */

function disposeInstance( instance ) {
  try {
    instance.buffer?.remove?.();
  } catch {
    // A buffer whose canvas is already gone is not worth a broken frame.
  }

  instance.buffer = null;
  instance.proxy = null;
  instance.ready = false;
}

function createBuffer(
  instance, host, width, height, type
) {
  disposeInstance( instance );

  const buffer = host.createGraphics(
    width,
    height,
    type === "webgl" ? host.WEBGL : host.P2D
  );

  instance.buffer = buffer;
  instance.state = {
    suppressBackground: false
  };
  instance.proxy = makeSurfaceProxy(
    buffer,
    host,
    instance.state
  );
  instance.width = width;
  instance.height = height;
  instance.type = type;
  instance.ready = false;
  instance.settingUp = false;
  instance.lastStep = null;
}

/**
 * Run one embedded call (setup or draw) with the surface and the options both
 * pointed at this layer. Always restores, including on a throw: a leaked
 * override would send the HOST's remaining draw into the buffer, which reads
 * as the page silently going blank.
 */
function runEmbedded(
  instance, item, fn
) {
  const previousSurface = pushSurfaceOverride( instance.proxy );
  const previousOptions = pushOptionsOverride( {
    sketch: item.settings ?? {},
    size: {
      width: instance.width,
      height: instance.height
    }
  } );

  try {
    return fn();
  } finally {
    popOptionsOverride( previousOptions );
    popSurfaceOverride( previousSurface );
  }
}

function runSetup(
  instance, item, fns
) {
  instance.settingUp = true;

  const startSetup = () => Promise.resolve( fns.setupFn?.( {
    center: sketch.getCanvasCenter(),
    canvas: instance.buffer,
    p: instance.proxy
  } ) );

  let pending;

  try {
    pending = runEmbedded(
      instance,
      item,
      startSetup
    );
  } catch( error ) {
    instance.settingUp = false;
    instance.error = error;
    console.warn(
      `[nested-sketch] setup failed for "${ instance.sketchPath }"`,
      error
    );
    return;
  }

  // A sketch's setup is allowed to be async (fonts, shaders, assets), so the
  // layer becomes ready a microtask later at the earliest — the first frame
  // after a layer is added or resized always draws nothing, by construction.
  //
  // The overrides above only cover the synchronous head of an async setup: one
  // that awaits resumes with getP5() pointing back at the host. In practice
  // setups await loads and then touch the surface through the `p` they were
  // handed, which stays the proxy; this is the documented limit of the
  // approach, not something the caller can work around.
  pending.then(
    () => {
      instance.settingUp = false;
      instance.ready = true;
    },
    ( error ) => {
      instance.settingUp = false;
      instance.error = error;
      console.warn(
        `[nested-sketch] setup failed for "${ instance.sketchPath }"`,
        error
      );
    }
  );
}

/**
 * Which redraw a layer running at its own rate is on, or null when it follows
 * the host and redraws every frame.
 *
 * The step is counted in LOOP time, not wall-clock: `time.drawSeconds()` is the
 * duration-scaled clock the whole engine animates from, and during capture it
 * is pinned to the frame index. So a 6 fps layer drops exactly the same frames
 * in the preview and in the recording, instead of sampling whatever the browser
 * happened to be managing at the time — which is what keeps a slow layer a
 * design decision rather than a rendering artefact.
 */
export function redrawStep(
  loopSeconds, framerate
) {
  if ( !( framerate > 0 ) || !Number.isFinite( loopSeconds ) ) {
    return null;
  }

  return Math.floor( loopSeconds * framerate );
}

function isRedrawDue(
  instance, framerate
) {
  const step = redrawStep(
    time.drawSeconds(),
    framerate
  );

  if ( step === null ) {
    return true;
  }

  if ( step === instance.lastStep ) {
    return false;
  }

  instance.lastStep = step;

  return true;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Draw one embedded-sketch layer into its own buffer and hand the buffer back,
 * or null while it is still loading (or has failed). The caller composites it.
 *
 * `key` addresses the layer the way the item-bounds registry does
 * ("<scope>:<index>"), so each layer keeps its own buffer and its own setup.
 */
export function renderNestedSketchLayer(
  key, item, width, height
) {
  const host = getHostP5();
  const sketchPath = item?.sketch;

  if ( !host || !sketchPath || width < 1 || height < 1 ) {
    return null;
  }

  if ( width > MAX_BUFFER_SIDE || height > MAX_BUFFER_SIDE ) {
    return null;
  }

  // Embedding an embedded sketch would recurse forever on a self-referencing
  // layer, and there is no composition worth that risk.
  if ( getSurfaceOverride() ) {
    return null;
  }

  registerDisposer();

  let instance = instances.get( key );

  if ( !instance ) {
    instance = {
      key,
      sketchPath: null,
      buffer: null,
      proxy: null,
      state: null,
      width: 0,
      height: 0,
      type: null,
      ready: false,
      settingUp: false,
      lastStep: null,
      error: null
    };
    instances.set(
      key,
      instance
    );
  }

  const frame = host.frameCount ?? 0;

  instance.lastSeenFrame = frame;

  if ( frame !== lastSweepFrame ) {
    lastSweepFrame = frame;
    sweepNestedSketches( frame );
  }

  if ( failed.has( sketchPath ) ) {
    return null;
  }

  if ( !hasSketchFns( sketchPath ) ) {
    ensureSketchLoaded( sketchPath );
    return null;
  }

  const fns = getSketchFns( sketchPath );
  const type = fns.sketchOptions?.type === "webgl" ? "webgl" : "p2d";

  // A different sketch, a different canvas size or a different renderer all
  // mean the layer has to be rebuilt from scratch: a sketch's setup() is where
  // it lays itself out against the canvas it was given.
  if (
    instance.sketchPath !== sketchPath ||
    instance.width !== width ||
    instance.height !== height ||
    instance.type !== type
  ) {
    instance.sketchPath = sketchPath;
    instance.error = null;
    createBuffer(
      instance,
      host,
      width,
      height,
      type
    );
  }

  if ( !instance.buffer ) {
    return null;
  }

  if ( instance.error ) {
    return null;
  }

  if ( !instance.ready ) {
    if ( !instance.settingUp ) {
      runSetup(
        instance,
        item,
        fns
      );
    }

    return null;
  }

  if ( !isRedrawDue(
    instance,
    item.framerate
  ) ) {
    // Not due: hand back what the last redraw left. That stale buffer IS the
    // effect — it is what makes a low layer frame rate read as stop-motion
    // rather than as a stutter.
    return instance.buffer;
  }

  const buffer = instance.buffer;

  instance.state.suppressBackground = item.drawBackground !== true;

  try {
    // p5.Graphics does not reset its matrix and styles between frames the way
    // the main canvas does, so an embedded sketch that translates once per
    // frame would walk off its own buffer within seconds.
    buffer.reset();

    if ( item.clearEachFrame !== false ) {
      buffer.clear();
    }

    buffer.push();

    runEmbedded(
      instance,
      item,
      () => fns.drawFn?.(
        time.drawSeconds(),
        sketch.getCanvasCenter(),
        sketch.favoriteColors.purple,
        instance.proxy
      )
    );

    buffer.pop();
  } catch( error ) {
    instance.error = error;
    console.warn(
      `[nested-sketch] draw failed for "${ instance.sketchPath }"`,
      error
    );
    return null;
  }

  return buffer;
}

/**
 * Free the buffers of layers that stopped being drawn (deleted, or on a slide
 * that is no longer shown). Runs once per host frame — a WebGL buffer per
 * removed layer is not something to leave to the GC, and every buffer also
 * holds a (hidden) canvas element in the document.
 */
export function sweepNestedSketches( frame = getHostP5()?.frameCount ?? 0 ) {
  instances.forEach( (
    instance, key
  ) => {
    if ( frame - ( instance.lastSeenFrame ?? 0 ) > IDLE_FRAMES_BEFORE_DISPOSE ) {
      disposeInstance( instance );
      instances.delete( key );
    }
  } );
}

/** Drop every embedded sketch. Called from sketch.reset(), between sketches. */
export function disposeNestedSketches() {
  instances.forEach( disposeInstance );
  instances.clear();
  failed.clear();
  lastSweepFrame = -1;
}

// Self-registered rather than imported by sketch.js: reset() has to free these
// buffers when the page moves to another sketch, and a static import the other
// way round would make the core runtime depend on the embedding feature.
//
// It happens on the first render, NOT at module scope: this module sits in a
// genuine import cycle (sketch.js → slides → freeLayout → drawSlideSketch →
// here), so `sketch` is still undefined while this module body runs. There is
// nothing to dispose before the first layer renders anyway.
function registerDisposer() {
  if ( sketch && !sketch.disposeNestedSketches ) {
    sketch.disposeNestedSketches = disposeNestedSketches;
  }
}
