// ── Running another sketch as a layer ──────────────────────────────────────
//
// The "sketch" content item (SketchLayerItemSchema) embeds a whole other p5
// sketch in the host sketch, the way an "image" item embeds a picture. This
// module owns everything that makes that possible; the renderer
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
// A fourth swap exists but is opt-in: the clock. By default an embedded sketch
// reads the HOST's loop phase, so the layer stays in sync with the page and the
// whole composition is a pure function of the frame index — which is what keeps
// headless capture deterministic, and why the per-layer `framerate` is counted
// in loop time rather than wall-clock. A layer that asks to sit elsewhere in
// the loop (`progression`, and `play: false` to freeze) gets a phase override
// (`pushPhaseOverride`, time.js) for the duration of its draw. That is still a
// pure function of the frame index, so the guarantee holds; see `layerPhase`.
//
// Freezing is NOT implemented as a pinned clock, though — a frozen layer stops
// being redrawn at all, and the buffer it last filled is what gets composited.
// A pinned clock only stops sketches that animate from the loop phase; one
// driving itself off p5's own random() or frameCount would carry on moving.
//
// ── The one sketch shape this cannot run: an async draw that awaits ─────────
//
// The swaps above are module globals, so they hold for exactly as long as the
// embedded draw runs *synchronously*. A `sketch.draw( async () => … )` that
// awaits mid-frame returns a pending promise, the swaps are restored, and its
// continuation resumes later reading the HOST's surface and the HOST's
// parameters — it paints the rest of itself onto the page's canvas, and
// usually throws first (`options.sketch.<its own key>` is undefined). Holding
// the swaps across the await is not the fix and was rejected: `freeLayout` goes
// straight on to the next content item in the same frame, so it would corrupt
// every layer drawn after this one instead.
//
// 38 of 301 p5 sketches draw that way, so this is refused rather than papered
// over: the module is checked once (`isAsyncDraw`), the layer never runs, and
// the picker greys those sketches out up front from `metadata.json`'s
// `asyncDraw` flag. Making them embeddable means giving the embedded run its
// own module realm — not a smaller change than this whole file.

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
import time, {
  pushPhaseOverride, popPhaseOverride
} from "./time.js";

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

/**
 * Whether a sketch's draw suspends mid-frame, which embedding cannot support
 * (see the header). Checked BEFORE the first call, so a refused layer never
 * paints a half-frame onto the host canvas.
 *
 * `AsyncFunction` is the check that costs nothing and is right for all 38 of
 * them. It has one false positive — an `async` draw that never actually awaits
 * would run synchronously and would have been fine — and it fails open if a
 * build ever downlevels async functions to generators, which is what the
 * thenable backstop at the call site is for.
 */
function isAsyncDraw( drawFn ) {
  return drawFn?.constructor?.name === "AsyncFunction";
}

const ASYNC_DRAW_REASON =
  "draws asynchronously (sketch.draw( async … )), which cannot run as a layer";

/**
 * Park a sketch in the failed set so no layer retries it, and say why once.
 * Shares `failed` with a genuine load error: from the renderer's side both mean
 * "this path never produces a buffer".
 */
function markUnsupported( sketchPath ) {
  if ( failed.has( sketchPath ) ) {
    return;
  }

  failed.set(
    sketchPath,
    new Error( ASYNC_DRAW_REASON )
  );
  console.warn( `[nested-sketch] "${ sketchPath }" ${ ASYNC_DRAW_REASON }` );
}

/**
 * Import one sketch module with the registration capture open around it, and
 * remember what it registered.
 */
async function importCaptured( sketchPath ) {
  const {
    loadSketchModule
  } = await import( "@/generated/sketchModuleRegistry" );

  // The capture is opened around the import ONLY. It is what keeps the host's
  // own _setupFn/_drawFn intact while the embedded module runs its top level.
  const capture = beginSketchCapture();

  try {
    await loadSketchModule(
      "p5",
      sketchPath
    );
  } finally {
    endSketchCapture();
  }

  rememberSketchFns(
    sketchPath,
    capture
  );

  if ( !hasSketchFns( sketchPath ) ) {
    // The module resolved but registered nothing. Either it is not a sketch,
    // or it was already imported earlier in this session AND never cached —
    // which the shared cache is there to prevent, so treat it as a real
    // failure rather than silently drawing nothing.
    throw new Error( `"${ sketchPath }" registered no draw function` );
  }
}

// Imports run one at a time. There is a single capture slot, and a module's
// top level runs whenever ITS chunk arrives: with two different sketches in
// flight, the first to finish closed the capture while the second was still
// loading, and the second's `sketch.draw( … )` then landed where it lands
// without a capture — on the host, replacing the page's own draw with the
// layer's. Seen as the page suddenly rendering an embedded sketch (and
// throwing from it, since that sketch's setup never ran on the page), while
// the layer that lost the race reported "registered no draw function".
let loadQueue = Promise.resolve();

function ensureSketchLoaded( sketchPath ) {
  if ( hasSketchFns( sketchPath ) || loading.has( sketchPath ) || failed.has( sketchPath ) ) {
    return;
  }

  loading.add( sketchPath );

  loadQueue = loadQueue
    .then( () => importCaptured( sketchPath ) )
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
  // Host methods are bound once per proxy, not once per access: a sketch that
  // calls `p.createGraphics` in setup pays nothing either way, but the trap is
  // also on the path of every `p.map()` / `p.sin()` in a hot loop, and a fresh
  // bound function per call there is allocation the sketch never asked for.
  const boundHostMethods = new Map();

  // What this layer allocates through the host — graphics buffers, mostly —
  // goes into the host's element registry (`_elements`) and stays there until
  // removed. A layer rebuilt on every resize would otherwise leave one buffer
  // behind per rebuild; disposeInstance removes what is recorded here.
  const trackGraphics = ( created ) => {
    if ( created && typeof created.remove === "function" ) {
      state.ownedGraphics.push( created );
    }

    return created;
  };

  return new Proxy(
    buffer,
    {
      get(
        target, prop, receiver
      ) {
        if ( prop === "background" && state.suppressBackground ) {
          return NOOP;
        }

        if ( prop === "createGraphics" && host ) {
          let tracked = boundHostMethods.get( prop );

          if ( !tracked ) {
            tracked = ( ...args ) => trackGraphics( host.createGraphics( ...args ) );
            boundHostMethods.set(
              prop,
              tracked
            );
          }

          return tracked;
        }

        // The size the sketch lays itself out for, which is NOT the buffer's
        // pixel size: `resolution` renders the same layout into fewer (or more)
        // pixels, and the draw is pre-scaled by that ratio. Everything a sketch
        // sizes from — p.width/p.height, sketch.getCanvasCenter(), and
        // `options.size` through the options override — reads this pair, so a
        // layer at half resolution is the same composition, not a crop of it.
        if ( prop === "width" ) {
          return state.width;
        }

        if ( prop === "height" ) {
          return state.height;
        }

        if ( host && HOST_METHODS.has( prop ) && typeof host[ prop ] === "function" ) {
          let bound = boundHostMethods.get( prop );

          if ( !bound ) {
            bound = host[ prop ].bind( host );
            boundHostMethods.set(
              prop,
              bound
            );
          }

          return bound;
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
  // Everything the embedded sketch allocated through the host, then the layer's
  // own buffer. Both are the host's `_elements` entries and hidden canvases.
  for ( const owned of instance.state?.ownedGraphics ?? [] ) {
    try {
      owned.remove();
    } catch {
      // Already gone; nothing to free.
    }
  }

  if ( instance.state ) {
    instance.state.ownedGraphics = [];
  }

  try {
    instance.buffer?.remove?.();
  } catch {
    // A buffer whose canvas is already gone is not worth a broken frame.
  }

  instance.buffer = null;
  instance.proxy = null;
  instance.ready = false;
  instance.frozenItem = null;
}

function createBuffer(
  instance, host, width, height, pixelWidth, pixelHeight, type
) {
  disposeInstance( instance );

  const buffer = host.createGraphics(
    pixelWidth,
    pixelHeight,
    type === "webgl" ? host.WEBGL : host.P2D
  );

  instance.buffer = buffer;
  instance.state = {
    suppressBackground: false,
    // What the sketch believes its canvas is (see makeSurfaceProxy).
    width,
    height,
    // Graphics the sketch created through the proxy, freed with the instance.
    ownedGraphics: []
  };
  instance.proxy = makeSurfaceProxy(
    buffer,
    host,
    instance.state
  );
  instance.width = width;
  instance.height = height;
  instance.pixelWidth = pixelWidth;
  instance.pixelHeight = pixelHeight;
  instance.type = type;
  instance.ready = false;
  instance.settingUp = false;
  instance.lastStep = null;
  instance.frozenItem = null;
}

/**
 * The loop phase this layer draws at, or null when it simply follows the host.
 *
 * `progression` is the layer's own loop origin: added to the host's phase while
 * the layer plays, and the whole answer while it is frozen. Null is returned —
 * rather than the host's phase — for the untouched case, so a layer at its
 * defaults installs no override at all and reads the host's clock verbatim,
 * including during capture where `time.phase()` climbs past 1 without wrapping.
 */
export function layerPhase(
  hostPhase, item
) {
  const raw = item?.progression;
  const offset = Number.isFinite( raw )
    ? Math.min(
      1,
      Math.max(
        0,
        raw
      )
    )
    : 0;

  if ( item?.play === false ) {
    return offset;
  }

  if ( offset === 0 || !Number.isFinite( hostPhase ) ) {
    return null;
  }

  const phase = hostPhase + offset;

  // Wrapped, because an offset layer is a layer running ahead of the page in
  // the SAME loop — `animation.progression` is a 0..1 value everywhere.
  return phase - Math.floor( phase );
}

/**
 * Run one embedded call (setup or draw) with the surface, the options and the
 * loop phase all pointed at this layer. Always restores, including on a throw:
 * a leaked override would send the HOST's remaining draw into the buffer, which
 * reads as the page silently going blank.
 */
function runEmbedded(
  instance, item, fn
) {
  const previousPhase = pushPhaseOverride( layerPhase(
    time.phase(),
    item
  ) );
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
    popPhaseOverride( previousPhase );
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
 * The buffer's pixel size for a layer laid out at `width` × `height`.
 *
 * `resolution` is a pixel density and nothing else: it never reaches the sketch
 * (the proxy keeps reporting the layout size), so lowering it renders the same
 * composition into fewer pixels — which is what it has always claimed to do —
 * rather than handing the sketch a smaller canvas and cropping the ones that
 * draw at absolute sizes.
 */
export function bufferPixels(
  width, height, resolution
) {
  const density = Number.isFinite( resolution ) && resolution > 0 ? resolution : 1;

  return {
    pixelWidth: Math.max(
      1,
      Math.round( width * density )
    ),
    pixelHeight: Math.max(
      1,
      Math.round( height * density )
    )
  };
}

/**
 * Draw one embedded-sketch layer into its own buffer and hand the buffer back,
 * or null while it is still loading (or has failed). The caller composites it.
 *
 * `width` / `height` are the canvas the SKETCH is laid out for; the caller
 * decides whether that is the layer's box (`sizing: "reflow"`) or the box it
 * would have at scale 1 (`sizing: "scale"`). `resolution` then only decides how
 * many pixels that layout is rendered into.
 *
 * `key` addresses the layer the way the item-bounds registry does
 * ("<scope>:<index>"), so each layer keeps its own buffer and its own setup.
 */
export function renderNestedSketchLayer(
  key, item, width, height, resolution = 1
) {
  const host = getHostP5();
  const sketchPath = item?.sketch;

  if ( !host || !sketchPath || width < 1 || height < 1 ) {
    return null;
  }

  const {
    pixelWidth, pixelHeight
  } = bufferPixels(
    width,
    height,
    resolution
  );

  // The cap is on what is actually allocated, so a supersampled layer is
  // refused on its texture size rather than on its layout.
  if ( pixelWidth > MAX_BUFFER_SIDE || pixelHeight > MAX_BUFFER_SIDE ) {
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
      pixelWidth: 0,
      pixelHeight: 0,
      type: null,
      ready: false,
      settingUp: false,
      lastStep: null,
      frozenItem: null,
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

  // Refused before the buffer is even allocated, and remembered as a load
  // failure so the layer is inert rather than half-drawn — see the header on
  // async draws.
  if ( isAsyncDraw( fns.drawFn ) ) {
    markUnsupported( sketchPath );
    return null;
  }

  const type = fns.sketchOptions?.type === "webgl" ? "webgl" : "p2d";

  // A different sketch, a different canvas size or a different renderer all
  // mean the layer has to be rebuilt from scratch: a sketch's setup() is where
  // it lays itself out against the canvas it was given.
  if (
    instance.sketchPath !== sketchPath ||
    instance.width !== width ||
    instance.height !== height ||
    instance.pixelWidth !== pixelWidth ||
    instance.pixelHeight !== pixelHeight ||
    instance.type !== type
  ) {
    instance.sketchPath = sketchPath;
    instance.error = null;
    createBuffer(
      instance,
      host,
      width,
      height,
      pixelWidth,
      pixelHeight,
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

  const frozen = item.play === false;

  if ( frozen ) {
    // A frozen layer is redrawn only when what it should be holding changes.
    // Identity is the whole test: the option store merges in place but treats
    // arrays as leaf values (`mergeChangedInPlace` / `valuesEqual` in
    // p5/shared/utils.js), so ANY edit inside a content list — the layer's
    // `progression`, one of the embedded sketch's own parameters — replaces the
    // whole `content` array with a clone, and leaves it untouched otherwise.
    // A cheaper signal than a per-frame deep compare, and a stricter one than a
    // frozen clock: not redrawing is what also stops a sketch that animates
    // from random() or frameCount rather than from the loop phase.
    if ( instance.frozenItem === item ) {
      return instance.buffer;
    }
  } else if ( !isRedrawDue(
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

    // The sketch drew for a `width` × `height` canvas; the buffer may hold a
    // different number of pixels because of `resolution`. One scale reconciles
    // them, so nothing downstream — not the sketch, not the compositing below
    // — has to know the two differ. (WEBGL scales about the buffer's centre,
    // P2D about its top-left; both are that renderer's own origin, so the
    // mapping is the same either way.)
    if ( instance.pixelWidth !== instance.width || instance.pixelHeight !== instance.height ) {
      buffer.scale(
        instance.pixelWidth / instance.width,
        instance.pixelHeight / instance.height
      );
    }

    const result = runEmbedded(
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

    // Backstop for the async-draw refusal above, in case `isAsyncDraw` failed
    // open. The swaps are already restored by now, so this frame's tail is
    // beyond saving — but the layer is stopped before a second one, and the
    // rejection is caught here rather than surfacing as an unhandled error
    // (which is how this arrives: a runtime overlay pointing at a line deep
    // inside the embedded sketch, with no hint that a layer is involved).
    if ( typeof result?.then === "function" ) {
      result.catch( () => {} );
      markUnsupported( instance.sketchPath );
      return null;
    }

    // Remembered only on a frame that actually completed, so a layer frozen
    // while its draw threw is retried rather than holding a half-frame forever.
    instance.frozenItem = frozen ? item : null;
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
