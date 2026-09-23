import {
  BaseSketchEngine
} from "@/engines/BaseSketchEngine";
import {
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  resolveSketchPath
} from "@/engines/metadata";
import {
  getAnimationBridge
} from "@/lib/animationBridge";
import {
  pauseLoop, resumeLoop
} from "@/p5/utils/loopControl.js";
import {
  FrameRateMeter
} from "@/engines/frameRateMeter";
import {
  resetLoadingProgress,
  subscribeLoadingProgress,
  reportAssetLoading,
  planLoadingSteps,
  finishLoadingProgress
} from "@/lib/assets/loadingProgress";
import {
  collectSketchImagePaths
} from "@/lib/assets/collectAssetPaths";

type P5SketchRuntime = {
  start: ( container: HTMLElement ) => Promise<any>;
  reset: () => void;
  getP5: () => any;
};

/**
 * P5.js implementation of `SketchEngine`.
 *
 * Uses p5 instance mode: the p5 constructor receives the container
 * element directly, so the canvas is created inside it — no need
 * for MutationObserver or body-level DOM queries.
 */
export class P5Engine extends BaseSketchEngine {
  readonly engineId = "p5";

  private sketchRuntime: P5SketchRuntime | null = null;
  private unsubscribeLoading: ( () => void ) | null = null;
  // Measures the real draw rate from p5's frameCount: counter deltas over a
  // sliding window converge within ~1s of a framerate change, where sampling
  // p5's instantaneous frameRate() (display-rate aliased, then smoothed)
  // lagged the true rate by several seconds.
  private perfMeter = new FrameRateMeter();

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    sketchName: string,
    options: SketchOption
  ): Promise<void> {
    this.container = container;

    // Fresh loading report for this sketch run, re-emitted as the engine's
    // `loading` event so the UI can show per-asset progress while `init()`
    // is still in flight.
    resetLoadingProgress();

    // Declare the expected total before anything opens a step, so the very
    // first snapshot the UI sees carries the real figure instead of a count
    // that climbs as each loader starts. Two modules always load (the sketch
    // module and the p5 library); the images are whatever the options ask for.
    //
    // Fonts, audio and video are deliberately NOT planned: font fields hold
    // font keys rather than file paths and never cover the fonts a sketch
    // hardcodes in its own code, video instances come from a sketch-supplied
    // callback, and audio assets are not wired into the options at all. A
    // partial plan would trade an unknown total for a wrong one — the
    // monotonic clamp in the registry already absorbs their late arrival.
    planLoadingSteps( {
      module: 2,
      image: collectSketchImagePaths( options ).length
    } );

    this.unsubscribeLoading?.();
    this.unsubscribeLoading = subscribeLoadingProgress( ( snapshot ) => {
      this.emit(
        "loading",
        snapshot
      );
    } );

    // Remove stale canvases from a previous run
    container
      .querySelectorAll( "canvas" )
      .forEach( ( el ) => el.remove() );

    // Push options into the global syncSketchOptions store so the
    // p5 sketch picks them up during setup.
    const {
      setSketchOptions
    } = await import( "@/lib/syncSketchOptions" );

    if ( this.destroyed ) {
      return;
    }

    setSketchOptions(
      options,
      "react"
    );

    // Dynamic-import the sketch module — the module calls
    // sketch.setup(fn, opts) and sketch.draw(fn) which store
    // the functions without creating the p5 instance yet.
    const sketchPath = resolveSketchPath(
      sketchName,
      "p5"
    );

    const {
      default: sketch
    } = await import( "@/p5/utils/sketch.js" );

    if ( this.destroyed ) {
      return;
    }

    this.sketchRuntime = sketch as P5SketchRuntime;

    // Loaded from the generated registry of literal dynamic imports — see
    // src/generated/sketchModuleRegistry.ts. A variable-path import here would
    // make the bundler build a context module over every sketch, compiling the
    // whole catalogue on each page in dev. The registry module is imported
    // dynamically (rather than at the top of the file) so its ~270 literal
    // import() code-split points are NOT registered on the sketch page's
    // initial compile — they only cost compile time once a sketch actually
    // mounts and calls init(), shaving that work off the page's first paint.
    const {
      loadSketchModule
    } = await import( "@/generated/sketchModuleRegistry" );

    await reportAssetLoading(
      "module",
      sketchPath ?? sketchName,
      loadSketchModule(
        "p5",
        sketchPath
      )
    )
      .catch( ( error ) => {
        this.emit(
          "error",
          error
        );
        throw error;
      } );

    // destroy() may have run while we were awaiting the dynamic imports
    // (e.g. React tearing down the tree on a parent error). Bail out
    // before touching sketchRuntime — otherwise `runtime._setupFn` throws.
    if ( this.destroyed || !this.sketchRuntime || !sketchPath ) {
      return;
    }

    // ES modules are cached — on second visit the module doesn't re-run,
    // leaving _setupFn/_drawFn null. Restore them from the shared per-path
    // cache, which the embedded-sketch loader writes to and reads from as well
    // (see src/sketches/p5/utils/sketchFnCache.js for why it must be shared).
    const runtime = this.sketchRuntime as any;
    const {
      getSketchFns, hasSketchFns, rememberSketchFns
    } = await import( "@/p5/utils/sketchFnCache.js" );

    if ( !hasSketchFns( sketchPath ) ) {
      rememberSketchFns(
        sketchPath,
        {
          setupFn: runtime._setupFn,
          drawFn: runtime._drawFn,
          sketchOptions: runtime.sketchOptions
        }
      );
    } else {
      const cached = getSketchFns( sketchPath );

      if ( cached ) {
        runtime._setupFn = cached.setupFn;
        runtime._drawFn = cached.drawFn;
        if ( !runtime.sketchOptions && cached.sketchOptions ) {
          runtime.sketchOptions = cached.sketchOptions;
        }
      }
    }

    await this.sketchRuntime.start( container );

    if ( this.destroyed || !this.sketchRuntime ) {
      return;
    }

    this.perfMeter.reset();

    // Wait for the first draw cycle to complete before marking as ready.
    // This ensures the canvas is fully rendered and ready to be measured/centered.
    // p5 gates its first draw on an animation frame, so registering here —
    // after the synchronous part of `start()` — always catches it.
    const {
      default: events
    } = await import( "@/sketches/p5/utils/events.js" );

    if ( this.destroyed ) {
      return;
    }

    await new Promise<void>( ( resolve ) => {
      const unregister = events.register(
        "post-draw",
        () => {
          unregister(); // Only listen to the first draw
          resolve();
        }
      );
    } );

    if ( this.destroyed ) {
      return;
    }

    // Expose a uniform headless-capture controller. Mirrors the long-standing
    // server behaviour (frame-based time + redraw stepping) but drives the
    // real p5 instance instead of relying on p5 global-mode functions that
    // don't exist in instance mode.
    registerServerCaptureController( {
      captureKind: "canvas",
      surfaceSelector: "canvas.p5Canvas",
      prepare: () => this.beginDeterministicCapture(),
      renderFrame: ( index ) => {
        // Pin the deterministic clock to this frame, then step exactly one
        // redraw. enableRecordingMode makes incrementElapsedTime derive time
        // from the pinned index, so each redraw advances by exactly one frame
        // — and an out-of-order or repeated request still renders the right
        // frame rather than drifting.
        window.setRecordingFrame?.( index );
        this.sketchRuntime?.getP5()?.redraw();
      }
    } );

    // A plan can overshoot — images still warm in the module-level cache open
    // no step — so pin the bar to 100% rather than letting the loading screen
    // vanish while it reads part-way.
    finishLoadingProgress();

    this.becomeReady();
  }

  protected teardown(): void {
    this.unsubscribeLoading?.();
    this.unsubscribeLoading = null;
    unregisterServerCaptureController();

    // p5 instance cleanup — removes canvas, stops draw, unbinds events.
    this.sketchRuntime?.getP5()?.remove();
    this.sketchRuntime?.reset();
    this.sketchRuntime = null;

    // Clean up scripts loaded by other libraries (decomp, CCapture, etc.)
    ( window as any ).removeLoadedScripts?.();
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    // Re-anchor the animation clock before resuming the draw loop.
    // Elapsed time is derived from p5 `millis()`, which keeps advancing
    // while the loop is stopped (tab hidden, viewport gesture, …). Without
    // this, the first pre-draw after resume would add the entire paused
    // duration in one jump and the animation would "teleport" forward.
    const bridge = getAnimationBridge();

    if ( bridge ) {
      bridge.setProgression( bridge.getProgression() );
    }

    resumeLoop( this.sketchRuntime?.getP5() );
    // Restart the measurement window: frameCount stood still while paused
    // and averaging across the gap would report a stale, too-low rate.
    this.perfMeter.reset();
    this.reportPlaying();
  }

  pause(): void {
    pauseLoop( this.sketchRuntime?.getP5() );
    this.reportPaused();
  }

  stop(): void {
    pauseLoop( this.sketchRuntime?.getP5() );

    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = 0;
    }

    this.perfMeter.reset();
    this.reportStopped();
  }

  seek( frame: number ): void {
    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = frame;
    }

    // Pin the deterministic recording clock to this frame so the upcoming
    // redraw renders at t = frame / frameRate. No-op during normal playback —
    // the sketch only consults the pinned index while in recording mode.
    window.setRecordingFrame?.( frame );

    // p5's redraw() runs the user draw synchronously: the frame is on the
    // canvas when this returns, which is what lets seekAndDraw() skip the
    // display-frame wait.
    p?.redraw();
  }

  redraw(): void {
    const p = this.sketchRuntime?.getP5();

    if ( !p ) {
      return;
    }

    // Sync the animation bridge so that the time delta on the upcoming
    // pre-draw is effectively 0 — the sketch stays on the same frame.
    const bridge = getAnimationBridge();

    if ( bridge ) {
      bridge.setProgression( bridge.getProgression() );
    }

    p.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  beginDeterministicCapture(): void {
    // Stop the live draw loop and switch the time utility to frame-based time.
    // From here `incrementElapsedTime` derives `elapsed` from the pinned
    // recording frame index (see `window.setRecordingFrame`, set inside
    // `seek()`) instead of p5 `millis()`, so every captured frame lands at
    // exactly t = frame / frameRate — identical to the server pipeline.
    pauseLoop( this.sketchRuntime?.getP5() );
    window.enableRecordingMode?.();
  }

  endDeterministicCapture(): void {
    window.disableRecordingMode?.();
  }

  getCanvas(): HTMLCanvasElement | null {
    // The main canvas carries p5's own class; the buffers `createGraphics`
    // makes are canvases in the same container, so a bare `canvas` query
    // could answer with one of those. Same selector the headless recorder
    // targets.
    return this.container?.querySelector( "canvas.p5Canvas" ) ??
      this.container?.querySelector( "canvas" ) ??
      null;
  }

  /* ---- performance ----------------------------------------------- */

  protected onPerformanceTick( now: number ): void {
    const p = this.sketchRuntime?.getP5();

    if ( !p ) {
      return;
    }

    this.perfMeter.sample(
      now,
      typeof p.frameCount === "number"
        ? p.frameCount
        : 0
    );
  }

  protected measureFps(): number {
    return this.perfMeter.fps;
  }
}
