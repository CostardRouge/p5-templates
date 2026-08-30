import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import {
  resumeReactSketchOptionsSync,
  setSketchOptions,
  suspendReactSketchOptionsSync
} from "@/lib/syncSketchOptions";
import deepClone from "@/utils/deepClone";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import type {
  ExportSize
} from "./variants";

/**
 * The runner's own writes carry their own origin.
 *
 * The suspend gate only buffers `"react"` — the form. Without a separate
 * origin the runner's own size push would be swallowed by the very gate it
 * just raised, and the canvas would never resize. The sketch runtime's
 * handler only ignores `"p5"`, so this origin flows through it normally.
 */
const EXPORT_ORIGIN = "export";

/**
 * How many polled frames to give the canvas to reach the target size.
 *
 * Budgeted in FRAMES, not milliseconds, on purpose: the settle is waiting on
 * the engine's own render loop, and a heavy sketch on a software renderer can
 * take seconds per frame. A wall-clock budget would abort those exports for
 * being slow rather than for being wrong. The absolute ceiling below is only
 * there to catch an engine that has stopped drawing altogether.
 */
const SETTLE_FRAME_BUDGET = 120;

/** Hard stop for an engine that never draws again. */
const SETTLE_CEILING_MS = 30_000;

/** Consecutive frames the surface must hold its dimensions after a resize. */
const STABLE_FRAMES = 2;

export type ExportOverride = {
  size: ExportSize;
  framerate: number;
};

export type OverrideHandle = {
  /**
   * Re-push the override. `window.setSlide()` re-derives the canvas size from
   * the slide's own settings, so every slide switch inside a run must be
   * followed by this.
   */
  reapply: () => Promise<void>;
  /** Put the sketch back the way it was found. Safe to call twice. */
  restore: () => Promise<void>;
};

function nextFrame(): Promise<void> {
  return new Promise( ( resolve ) => {
    if ( typeof requestAnimationFrame !== "function" ) {
      setTimeout(
        resolve,
        16
      );

      return;
    }

    requestAnimationFrame( () => resolve() );
  } );
}

/**
 * Strip every per-slide `size` / `animation` override.
 *
 * A global size push is otherwise invisible on any deck whose active slide
 * carries its own size: p5's `getEffective()` and the GSAP runtime both merge
 * the slide's override *over* the global value, so `setSketchOptions({ size })`
 * would resize nothing and the variant would silently encode at the wrong
 * resolution.
 *
 * Arrays are leaf values to the store's merge, so handing back a whole
 * rewritten `slides` array replaces the old one outright. For the duration of
 * a run there is then exactly one authoritative source for size and framerate,
 * which is also what makes a mid-run `setSlide()` re-apply *our* override
 * rather than the slide's.
 */
function stripSlideOverrides( slides: SketchOption[ "slides" ] ): SketchOption[ "slides" ] {
  if ( !Array.isArray( slides ) ) {
    return slides;
  }

  return slides.map( ( slide ) => {
    const {
      size: _size,
      animation: _animation,
      ...rest
    } = slide as Record<string, unknown>;

    return rest;
  } ) as SketchOption[ "slides" ];
}

/**
 * Read the capture surface's current pixel dimensions.
 *
 * p5 calls `pixelDensity( 1 )`, so the backing store matches the declared
 * canvas size 1:1 and a direct comparison against the target is meaningful.
 */
function readSurface( engine: SketchEngine ): ExportSize | null {
  try {
    const source = engine.getCaptureSource();

    if ( !source.width || !source.height ) {
      return null;
    }

    return {
      width: source.width,
      height: source.height
    };
  } catch {
    return null;
  }
}

/**
 * Block until the capture surface reports `target`, holding it for a couple of
 * frames.
 *
 * The push itself is synchronous on p5, but GSAP re-renders a React tree and
 * Three.js resizes from its own store subscription, so the resize can land a
 * frame or two later. Capturing before it does is not a one-frame glitch:
 * `AsyncLoopRecorder` snapshots the encoder's dimensions once at `start()`, so
 * an early read bakes the wrong size into the whole clip.
 */
async function waitForSurface(
  engine: SketchEngine,
  target: ExportSize,
  signal?: AbortSignal
): Promise<void> {
  const deadline = Date.now() + SETTLE_CEILING_MS;
  let framesPolled = 0;
  let sawMismatch = false;
  let stable = 0;

  for ( ;; ) {
    if ( signal?.aborted ) {
      throw new DOMException(
        "Export cancelled.",
        "AbortError"
      );
    }

    const surface = readSurface( engine );
    const matches = Boolean( surface &&
        surface.width === target.width &&
        surface.height === target.height );

    if ( matches ) {
      // Already the right size on the very first look: no resize was needed,
      // so there is nothing to settle. Waiting out the stability window here
      // would cost two frames on every variant that happens to match the live
      // canvas — the most common case there is, and seconds of it on a slow
      // renderer.
      if ( !sawMismatch ) {
        return;
      }

      stable++;

      if ( stable >= STABLE_FRAMES ) {
        return;
      }
    } else {
      sawMismatch = true;
      stable = 0;
    }

    if ( framesPolled >= SETTLE_FRAME_BUDGET || Date.now() > deadline ) {
      const seen = surface
        ? `${ surface.width }x${ surface.height }`
        : "an unreadable surface";

      throw new Error( `Canvas did not resize to ${ target.width }x${ target.height } (still ${ seen }).` );
    }

    framesPolled++;
    await nextFrame();
  }
}

/**
 * Push a variant's canvas size and framerate into the running sketch, and hand
 * back the means to undo it.
 *
 * This is what makes a Reel variant next to a square one meaningful: the
 * sketch is genuinely re-laid out at each target resolution rather than being
 * captured once and rescaled. The framerate override is equally real — the
 * deterministic clock derives `elapsed` from `sketch.sketchOptions.animation`,
 * so a pushed rate re-times the capture instead of relabelling the container.
 *
 * Always use it as a scope:
 *
 * ```
 * const handle = await applyExportOverrides( engine, options, override );
 * try { ...capture... } finally { await handle.restore(); }
 * ```
 *
 * The `finally` is not optional. A run that throws or is cancelled half-way
 * must never leave the user's canvas at 1080x1920.
 */
export async function applyExportOverrides(
  engine: SketchEngine,
  options: SketchOption,
  override: ExportOverride,
  signal?: AbortSignal
): Promise<OverrideHandle> {
  const baseline = deepClone( {
    size: options.size,
    animation: options.animation,
    slides: options.slides
  } );

  const {
    animation
  } = getEffectiveSlideSettings( options );
  const {
    duration
  } = resolveAnimation( animation );

  const partial = {
    size: {
      ...override.size
    },
    animation: {
      ...( options.animation ?? {} ),
      duration,
      framerate: override.framerate
    },
    slides: stripSlideOverrides( options.slides )
  };

  // The runner owns the store from here: the form must not push the user's
  // real canvas size back mid-capture.
  suspendReactSketchOptionsSync();

  let restored = false;

  const push = async() => {
    setSketchOptions(
      deepClone( partial ),
      EXPORT_ORIGIN
    );

    await waitForSurface(
      engine,
      override.size,
      signal
    );

    // p5's resize reallocates the backing store, leaving the canvas blank
    // until something draws. The video path redraws via `resetToStart()`, but
    // a still capture reads the surface immediately and would grab an empty
    // frame.
    try {
      engine.redraw();
    } catch {
      // A redraw failure is not worth aborting an export over.
    }

    await nextFrame();
  };

  try {
    await push();
  } catch( error ) {
    // The gate is suspended before the first push, so a push that throws
    // (a resize that never lands, a cancel mid-settle) would otherwise leave
    // the studio permanently deaf to its own form.
    setSketchOptions(
      baseline,
      EXPORT_ORIGIN
    );
    resumeReactSketchOptionsSync();

    throw error;
  }

  return {
    reapply: push,
    restore: async() => {
      if ( restored ) {
        return;
      }

      restored = true;

      try {
        setSketchOptions(
          baseline,
          EXPORT_ORIGIN
        );
      } finally {
        // Resuming replays whatever the form tried to push during the run, so
        // an edit made mid-export lands rather than being dropped.
        resumeReactSketchOptionsSync();
      }
    }
  };
}
