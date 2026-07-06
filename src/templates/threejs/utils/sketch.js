/* ------------------------------------------------------------------ */
/*  Three.js sketch runtime                                            */
/* ------------------------------------------------------------------ */

/**
 * Self-contained Three.js runtime.
 *
 * Mirrors the role of the p5 `sketch.js` singleton: a Three.js template calls
 * `sketch.setup( fn )` / `sketch.draw( fn )` at import time to register its
 * lifecycle callbacks, and `ThreeEngine` drives the rest — creating the
 * WebGL renderer, running the animation loop, and stepping frames
 * deterministically for capture.
 *
 * The loop clock is a duration-scaled loop phase (identical model to the p5
 * `time` module) so the live preview, the progression bar and a headless
 * recording all resolve the exact same position in the loop.
 */
import {
  resolveAnimation, DURATION_DEFAULT
} from "@/lib/animationConfig";
import {
  getSketchOptions, subscribeSketchOptions
} from "@/p5/shared/syncSketchOptions.js";

/* ---- time / loop clock ------------------------------------------- */

const time = {
  elapsed: 0,
  lastUpdate: 0,
  recordingFrameIndex: 0,
  isRecording: false,

  seconds() {
    return time.elapsed / 1000;
  },

  // Loop phase in [0, 1). During recording it climbs monotonically (never
  // wraps) so the final captured frame sits just under a full loop.
  phase() {
    const {
      duration
    } = resolveAnimation( getSketchOptions()?.animation );
    const seconds = time.seconds();

    return time.isRecording
      ? seconds / duration
      : ( seconds % duration ) / duration;
  },

  // The clock handed to a sketch's `draw( time, … )`. Scaled by the baseline
  // duration so a sketch authored against it completes its whole loop within
  // `duration`, and at the default duration equals the historical seconds clock.
  drawSeconds() {
    return time.phase() * DURATION_DEFAULT;
  },

  reset() {
    time.elapsed = 0;
    time.lastUpdate = 0;
    time.recordingFrameIndex = 0;
  },

  // Advance the clock by one tick. During recording, time is pinned to the
  // frame index (frame / framerate); otherwise it free-runs on wall-clock.
  increment( now ) {
    if ( time.isRecording ) {
      const {
        framerate
      } = resolveAnimation( getSketchOptions()?.animation );
      const millisecondsPerFrame = 1000 / framerate;

      time.elapsed = time.recordingFrameIndex * millisecondsPerFrame;
      time.recordingFrameIndex++;
      return;
    }

    if ( time.lastUpdate === 0 ) {
      time.lastUpdate = now;
    }

    time.elapsed += now - time.lastUpdate;
    time.lastUpdate = now;
  }
};

/* ---- module state ------------------------------------------------ */

let THREE = null;
let renderer = null;
let scene = null;
let camera = null;
let container = null;
let rafId = null;
let frameCount = 0;

// Index of the slide currently on screen, or null when the deck has no slides.
// Driven by the shared studio UI through `ThreeEngine` → `window.setSlide`, and
// read back by the options accessor so `options.sketch` merges this slide's
// overrides (see @/threejs/utils/options.js). Without it, editing a parameter
// once slides exist would look frozen — the edit lands on the slide override,
// not the global block the accessor would otherwise return.
let activeSlideIndex = null;

// Real draw-rate measurement over a sliding window (frame deltas / elapsed),
// used for the performance overlay.
const fpsWindow = {
  lastSampleTime: 0,
  lastFrameCount: 0,
  measured: 0
};

const progressionSubscribers = new Set();

// Set while a recording (async-loop or realtime) is in progress. The clear
// alpha is forced to 1 for the duration so a sketch that leaves its
// background transparent (scene.background === null) for a nicer live
// preview doesn't export as solid black — encoders (gif.js, WebCodecs,
// MediaRecorder's canvas.captureStream()) all discard the alpha channel.
let forcingOpaqueCapture = false;

// Options-change subscription set up once in start(), torn down in reset().
let unsubscribeOptions = null;
let previousSize = null;

const DEFAULT_SIZE = {
  width: 1080,
  height: 1350
};

function resolveSize() {
  const size = getSketchOptions()?.size ?? DEFAULT_SIZE;
  const width = size.width ?? DEFAULT_SIZE.width;
  const height = size.ratio ? width / size.ratio : ( size.height ?? DEFAULT_SIZE.height );

  return {
    width,
    height
  };
}

function isEqualSize(
  a, b
) {
  return !!a && !!b && a.width === b.width && a.height === b.height;
}

// Apply a live "size" option change to the already-mounted renderer/camera.
// Unlike start()'s one-time sizing, this must also update the camera's aspect
// ratio and re-render immediately so the new resolution is visible on the
// very next paint instead of the next natural rAF tick.
function applyResize( size ) {
  if ( !renderer || !camera ) {
    return;
  }

  renderer.setSize(
    size.width,
    size.height
  );
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  renderOnce();
}

// Mirrors p5's options.js `handleOptionsChange`/GSAP's `applyOptions`: the
// engine stays mounted across option edits (see EngineSketchRenderer), so it
// must self-subscribe to the shared options store to react to a live
// resolution change instead of relying on a remount.
function subscribeToOptionChanges() {
  previousSize = resolveSize();

  unsubscribeOptions = subscribeSketchOptions( () => {
    const size = resolveSize();

    if ( !isEqualSize(
      size,
      previousSize
    ) ) {
      previousSize = size;
      applyResize( size );
    }
  } );
}

/** The context object handed to every sketch `setup`/`draw` callback. */
function drawContext() {
  return {
    THREE,
    renderer,
    scene,
    camera,
    time: time.drawSeconds(),
    phase: time.phase(),
    frame: frameCount,
    width: renderer ? resolveSize().width : DEFAULT_SIZE.width,
    height: renderer ? resolveSize().height : DEFAULT_SIZE.height
  };
}

function notifyProgression() {
  const value = time.phase() % 1;

  progressionSubscribers.forEach( ( cb ) => {
    try {
      cb( value );
    } catch {
      // A subscriber must never break the draw loop.
    }
  } );
}

/* ---- render steps ------------------------------------------------ */

function renderScene( ctx ) {
  sketch._drawFn?.(
    ctx.time,
    ctx
  );

  if ( renderer && scene && camera ) {
    // A sketch's own draw() may set scene.background back to null every
    // frame (e.g. to keep a transparent live preview) — force opacity here,
    // right before the actual GPU clear/draw, so it sticks for a capture.
    if ( forcingOpaqueCapture ) {
      renderer.setClearAlpha( 1 );
    }

    renderer.render(
      scene,
      camera
    );
  }
}

// One live tick: advance the clock, draw, render, update measurements.
function tick( now ) {
  time.increment( now );

  const ctx = drawContext();

  renderScene( ctx );

  frameCount++;
  sampleFps( now );
  notifyProgression();
}

function sampleFps( now ) {
  if ( fpsWindow.lastSampleTime === 0 ) {
    fpsWindow.lastSampleTime = now;
    fpsWindow.lastFrameCount = frameCount;
    return;
  }

  const elapsed = now - fpsWindow.lastSampleTime;

  if ( elapsed >= 500 ) {
    const frames = frameCount - fpsWindow.lastFrameCount;

    fpsWindow.measured = ( frames * 1000 ) / elapsed;
    fpsWindow.lastSampleTime = now;
    fpsWindow.lastFrameCount = frameCount;
  }
}

function loop( now ) {
  if ( sketch.paused ) {
    rafId = null;
    return;
  }

  rafId = requestAnimationFrame( loop );
  tick( now );
}

function startLoop() {
  if ( rafId !== null ) {
    return;
  }

  sketch.paused = false;
  time.lastUpdate = 0;
  rafId = requestAnimationFrame( loop );
}

function stopLoop() {
  if ( rafId !== null ) {
    cancelAnimationFrame( rafId );
    rafId = null;
  }

  sketch.paused = true;
}

/* ---- public runtime --------------------------------------------- */

const sketch = {
  // stored sketch callbacks (set by the sketch module at import time)
  _setupFn: null,
  _drawFn: null,

  paused: false,

  /* -- registration API (called by sketch modules) ---------------- */

  setup( setupFunction ) {
    sketch._setupFn = typeof setupFunction === "function"
      ? setupFunction
      : null;
  },

  draw( drawFunction ) {
    sketch._drawFn = typeof drawFunction === "function"
      ? drawFunction
      : null;
  },

  /* -- lifecycle (called by ThreeEngine) -------------------------- */

  async start( mountContainer ) {
    THREE = await import( "three" );
    container = mountContainer;

    const {
      width, height
    } = resolveSize();

    renderer = new THREE.WebGLRenderer( {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // required so toDataURL() reads real pixels
    } );

    renderer.setPixelRatio( Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio : 1,
      2
    ) );
    renderer.setSize(
      width,
      height
    );
    renderer.setClearColor(
      0x000000,
      0
    );

    // A distinguishing class so the headless capture pipeline can target the
    // Three.js canvas via a generic CSS selector.
    renderer.domElement.classList.add( "threejs-canvas" );
    container.appendChild( renderer.domElement );

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      50,
      width / height,
      0.1,
      1000
    );
    camera.position.z = 5;

    time.reset();
    frameCount = 0;
    fpsWindow.lastSampleTime = 0;
    fpsWindow.lastFrameCount = 0;
    fpsWindow.measured = 0;

    await sketch._setupFn?.( drawContext() );

    subscribeToOptionChanges();

    // Render the very first frame synchronously so the canvas is painted
    // (and measurable) the instant `start` resolves.
    tick( performance.now() );

    startLoop();
  },

  reset() {
    stopLoop();

    unsubscribeOptions?.();
    unsubscribeOptions = null;
    previousSize = null;
    forcingOpaqueCapture = false;

    scene?.traverse( ( object ) => {
      object.geometry?.dispose?.();

      const material = object.material;

      if ( Array.isArray( material ) ) {
        material.forEach( ( m ) => m.dispose?.() );
      } else {
        material?.dispose?.();
      }
    } );

    renderer?.dispose?.();
    renderer?.domElement?.remove?.();

    renderer = null;
    scene = null;
    camera = null;
    container = null;
    THREE = null;
    frameCount = 0;
    activeSlideIndex = null;
    progressionSubscribers.clear();
    time.reset();
  },

  /* -- playback --------------------------------------------------- */

  play() {
    startLoop();
  },

  pause() {
    stopLoop();
  },

  stop() {
    stopLoop();
    time.reset();
    frameCount = 0;
    renderOnce();
  },

  /* -- scrubbing / capture ---------------------------------------- */

  // Re-render the current state without advancing the loop clock (used while
  // scrubbing or reflecting an option change while paused).
  redraw() {
    renderOnce();
    notifyProgression();
  },

  // Deterministically render an explicit frame index. Pins the recording clock
  // to `frame` so the sketch is drawn at t = frame / framerate.
  stepFrame( frame ) {
    time.recordingFrameIndex = Math.max(
      0,
      Math.floor( frame ) || 0
    );

    const ctx = drawContext();

    // In recording mode `increment` derives `elapsed` from the pinned index.
    time.increment( performance.now() );
    ctx.time = time.drawSeconds();
    ctx.phase = time.phase();
    renderScene( ctx );
    notifyProgression();
  },

  enterRecordingMode() {
    stopLoop();
    time.reset();
    time.isRecording = true;
    sketch.beginOpaqueCapture();
  },

  exitRecordingMode() {
    time.isRecording = false;
    time.reset();
    sketch.endOpaqueCapture();
  },

  // Force an opaque backdrop for the duration of a capture (async-loop mode
  // enters this via enterRecordingMode(); realtime mode has no analogous
  // deterministic-capture hook, so ThreeEngine's CaptureSource calls these
  // directly from beginRealtime()/endRealtime()).
  beginOpaqueCapture() {
    forcingOpaqueCapture = true;
  },

  endOpaqueCapture() {
    forcingOpaqueCapture = false;
    renderer?.setClearAlpha( 0 );
  },

  /* -- slides ----------------------------------------------------- */

  // Switch to a slide. `ThreeEngine` wires the shared `window.setSlide` here so
  // the slide carousel drives Three.js like it drives p5/GSAP. Records the index
  // (read by the options accessor to merge per-slide overrides), tags the canvas
  // with `data-slide` (thumbnail slide-sync + headless recorder key off it), and
  // repaints so the switch is visible immediately even while paused.
  setSlide( index ) {
    const next =
      typeof index === "number" && Number.isFinite( index ) && index >= 0
        ? Math.floor( index )
        : 0;

    activeSlideIndex = next;

    if ( renderer?.domElement ) {
      renderer.domElement.dataset.slide = String( next );
    }

    renderOnce();
    notifyProgression();
  },

  getActiveSlideIndex() {
    return activeSlideIndex;
  },

  /* -- progression bridge ----------------------------------------- */

  getProgression() {
    return time.phase() % 1;
  },

  setProgression( value ) {
    const clamped = Math.max(
      0,
      Math.min(
        1,
        Number( value ) || 0
      )
    );
    const {
      duration
    } = resolveAnimation( getSketchOptions()?.animation );

    time.elapsed = clamped * duration * 1000;
    time.lastUpdate = 0;
    renderOnce();
    notifyProgression();
  },

  subscribeProgression( cb ) {
    progressionSubscribers.add( cb );

    return () => progressionSubscribers.delete( cb );
  },

  /* -- accessors -------------------------------------------------- */

  isPaused() {
    return sketch.paused;
  },

  getFrameCount() {
    return frameCount;
  },

  getMeasuredFps() {
    return fpsWindow.measured;
  },

  getCanvas() {
    return renderer?.domElement ?? null;
  },

  getRenderer() {
    return renderer;
  },

  getScene() {
    return scene;
  },

  getCamera() {
    return camera;
  }
};

// Render the current scene without touching the clock.
function renderOnce() {
  if ( !renderer || !scene || !camera ) {
    return;
  }

  const ctx = drawContext();

  renderScene( ctx );
}

export default sketch;

export const getThree = () => THREE;
export const getScene = () => scene;
export const getCamera = () => camera;
export const getRenderer = () => renderer;
export const getCanvas = () => renderer?.domElement ?? null;
export const getActiveSlideIndex = () => activeSlideIndex;
