import type {
  SketchEngine,
  EngineEventName,
  EngineEventMap,
  EnginePerformanceSample
} from "@/engines/types";
import type {
  CaptureSource,
  RecorderCapabilities
} from "@/engines/recording/types";
import {
  createCanvasCaptureSource
} from "@/engines/recording/captureSource";
import {
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  getEffectiveSlideSettings
} from "@/lib/effectiveSlideSettings";
import {
  resolveAnimation, totalFramesFor
} from "@/lib/animationConfig";
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
export class P5Engine implements SketchEngine {
  readonly engineId = "p5";

  // ES modules are cached after first import — the module body won't
  // re-execute on second visit, so _setupFn/_drawFn stay null after reset().
  // We cache them here and restore on subsequent visits.
  private static readonly _sketchModuleCache = new Set<string>();
  private static readonly _sketchFnCache = new Map<string, {
    setupFn: ( ( ...args: any[] ) => any ) | null;
    drawFn: ( ( ...args: any[] ) => any ) | null;
    sketchOptions: any;
  }>();

  private _isReady = false;
  private container: HTMLElement | null = null;
  private sketchRuntime: P5SketchRuntime | null = null;
  private listeners = new Map<string, Set<( payload: any ) => void>>();
  private perfLoopId: number | null = null;
  // Measures the real draw rate from p5's frameCount: counter deltas over a
  // sliding window converge within ~1s of a framerate change, where sampling
  // p5's instantaneous frameRate() (display-rate aliased, then smoothed)
  // lagged the true rate by several seconds.
  private perfMeter = new FrameRateMeter();
  private perfSample = {
    paused: false,
    fps: 0,
    lastEmitTime: 0
  };

  get isReady(): boolean {
    return this._isReady;
  }

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    templatePath: string,
    options: SketchOption
  ): Promise<void> {
    this.container = container;

    // Remove stale canvases from a previous run
    container
      .querySelectorAll( "canvas" )
      .forEach( ( el ) => el.remove() );

    // Push options into the global syncSketchOptions store so the
    // p5 sketch picks them up during setup.
    const {
      setSketchOptions
    } = await import( "@/lib/syncSketchOptions" );

    setSketchOptions(
      options,
      "react"
    );

    // Dynamic-import the sketch module — the module calls
    // sketch.setup(fn, opts) and sketch.draw(fn) which store
    // the functions without creating the p5 instance yet.
    const sketchPath = resolveSketchPath(
      templatePath,
      "p5"
    );

    const {
      default: sketch
    } = await import( "@/p5/utils/sketch.js" );

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

    await loadSketchModule(
      "p5",
      sketchPath
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
    if ( !this.sketchRuntime || !sketchPath ) {
      return;
    }

    // ES modules are cached — on second visit the module doesn't re-run,
    // leaving _setupFn/_drawFn null. Restore them from our static cache.
    const runtime = this.sketchRuntime as any;

    if ( !P5Engine._sketchModuleCache.has( sketchPath ) ) {
      P5Engine._sketchModuleCache.add( sketchPath );
      P5Engine._sketchFnCache.set(
        sketchPath,
        {
          setupFn: runtime._setupFn,
          drawFn: runtime._drawFn,
          sketchOptions: runtime.sketchOptions
        }
      );
    } else {
      const cached = P5Engine._sketchFnCache.get( sketchPath );

      if ( cached ) {
        runtime._setupFn = cached.setupFn;
        runtime._drawFn = cached.drawFn;
        if ( !runtime.sketchOptions && cached.sketchOptions ) {
          runtime.sketchOptions = cached.sketchOptions;
        }
      }
    }

    await this.sketchRuntime.start( container );

    if ( !this.sketchRuntime ) {
      return;
    }

    this.perfMeter.reset();
    this.perfSample = {
      paused: false,
      fps: 0,
      lastEmitTime: performance.now()
    };

    // Wait for the first draw cycle to complete before marking as ready.
    // This ensures the canvas is fully rendered and ready to be measured/centered.
    await new Promise<void>( async( resolve ) => {
      const {
        default: events
      } = await import( "@/sketches/p5/utils/events.js" );

      const unregister = events.register(
        "post-draw",
        () => {
          unregister(); // Only listen to the first draw
          resolve();
        }
      );
    } );

    this._isReady = true;

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

    this.emit(
      "ready",
      undefined as any
    );
  }

  destroy(): void {
    this.stopPerformanceLoop();
    unregisterServerCaptureController();

    // p5 instance cleanup — removes canvas, stops draw, unbinds events.
    this.sketchRuntime?.getP5()?.remove();
    this.sketchRuntime?.reset();
    this.sketchRuntime = null;

    // Clean up scripts loaded by other libraries (decomp, CCapture, etc.)
    ( window as any ).removeLoadedScripts?.();

    this._isReady = false;
    this.container = null;
    this.listeners.clear();
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    import( "@/lib/syncSketchOptions" ).then( ( {
      setSketchOptions
    } ) => setSketchOptions(
      partial,
      "react"
    ) );
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
    this.perfSample.paused = false;
    this.emitPerformanceSample();
  }

  pause(): void {
    pauseLoop( this.sketchRuntime?.getP5() );
    this.perfSample.paused = true;
    this.emitPerformanceSample();
  }

  stop(): void {
    pauseLoop( this.sketchRuntime?.getP5() );
    this.perfSample.paused = true;

    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = 0;
    }

    this.perfMeter.reset();
    this.perfSample.fps = 0;
    this.emitPerformanceSample();
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

    this.sketchRuntime?.getP5()?.redraw();
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

  async captureFrame( frame: number ): Promise<string> {
    await this.seekAndDraw( frame );

    const canvas = this.getCanvas();

    if ( !canvas ) {
      throw new Error( "P5Engine: no canvas available for capture." );
    }

    return canvas.toDataURL( "image/png" );
  }

  async seekAndDraw( frame: number ): Promise<void> {
    this.seek( frame );

    // Allow one rAF for the draw cycle to complete.
    await new Promise( ( r ) => requestAnimationFrame( r ) );
  }

  async resetToStart(): Promise<void> {
    const bridge = getAnimationBridge();

    bridge?.setProgression( 0 );

    await this.seekAndDraw( 0 );
  }

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

  getRecordingCapabilities(
    _options: SketchOption,
    _slideIndex?: number
  ): RecorderCapabilities {
    return {
      supportsDeterministicCapture: true,
      defaultMode: "async-loop",
      supportedFormats: [
        "webm",
        "gif",
        "mp4"
      ]
    };
  }

  getTotalFrames(
    options: SketchOption,
    slideIndex?: number
  ): number {
    const {
      animation
    } = getEffectiveSlideSettings(
      options,
      slideIndex
    );

    return totalFramesFor( animation );
  }

  getFrameRate(
    options: SketchOption,
    slideIndex?: number
  ): number {
    const {
      animation
    } = getEffectiveSlideSettings(
      options,
      slideIndex
    );

    return resolveAnimation( animation ).framerate;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.container?.querySelector( "canvas" ) ?? null;
  }

  getCaptureSource(): CaptureSource {
    return createCanvasCaptureSource( () => this.getCanvas() );
  }

  /* ---- events ---------------------------------------------------- */

  on<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[ E ] ) => void
  ): void {
    if ( !this.listeners.has( event ) ) {
      this.listeners.set(
        event,
        new Set()
      );
    }

    this.listeners.get( event )!.add( handler );

    if ( event === "performance" ) {
      this.startPerformanceLoop();
      this.emitPerformanceSample();
    }
  }

  off<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[ E ] ) => void
  ): void {
    this.listeners.get( event )?.delete( handler );

    if ( event === "performance" && !this.hasPerformanceListeners() ) {
      this.stopPerformanceLoop();
    }
  }

  private emit<E extends EngineEventName>(
    event: E,
    payload: EngineEventMap[ E ]
  ): void {
    this.listeners.get( event )?.forEach( ( h ) => h( payload ) );
  }

  private hasPerformanceListeners(): boolean {
    return ( this.listeners.get( "performance" )?.size ?? 0 ) > 0;
  }

  private startPerformanceLoop(): void {
    if ( this.perfLoopId !== null ) {
      return;
    }

    const tick = ( now: number ) => {
      if ( !this.hasPerformanceListeners() ) {
        this.perfLoopId = null;
        return;
      }

      const p = this.sketchRuntime?.getP5();

      if ( p && this._isReady ) {
        const frameCount = typeof p.frameCount === "number"
          ? p.frameCount
          : 0;

        const fps = this.perfMeter.sample(
          now,
          frameCount
        );

        if ( now - this.perfSample.lastEmitTime >= 500 ) {
          this.perfSample.fps = fps;
          this.perfSample.lastEmitTime = now;
          this.emitPerformanceSample();
        }
      }

      this.perfLoopId = requestAnimationFrame( tick );
    };

    this.perfLoopId = requestAnimationFrame( tick );
  }

  private stopPerformanceLoop(): void {
    if ( this.perfLoopId === null ) {
      return;
    }

    cancelAnimationFrame( this.perfLoopId );
    this.perfLoopId = null;
  }

  private emitPerformanceSample(): void {
    const payload: EnginePerformanceSample = {
      fps: Number.isFinite( this.perfSample.fps )
        ? this.perfSample.fps
        : 0,
      paused: this.perfSample.paused,
      timestamp: performance.now()
    };

    this.emit(
      "performance",
      payload
    );
  }
}
