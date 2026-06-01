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
  resolveSketchPath
} from "@/engines/metadata";
import {
  getAnimationBridge
} from "@/lib/animationBridge";

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
  private perfSample = {
    paused: false,
    smoothedFps: 0,
    lastEmitTime: 0,
    rawSamples: [] as number[]
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

    await import( `@/p5/sketches/${ sketchPath }/index.js` )
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

    const p = this.sketchRuntime?.getP5();

    this.perfSample = {
      paused: false,
      smoothedFps: 0,
      lastEmitTime: performance.now(),
      rawSamples: typeof p?.frameRate === "function"
        ? [
          p.frameRate()
        ].filter( ( value ) => Number.isFinite( value ) && value > 0 )
        : []
    };

    // Wait for the first draw cycle to complete before marking as ready.
    // This ensures the canvas is fully rendered and ready to be measured/centered.
    await new Promise<void>( async( resolve ) => {
      const {
        default: events
      } = await import( "@/templates/p5/utils/events.js" );

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
      prepare: () => {
        window.enableRecordingMode?.();
        this.sketchRuntime?.getP5()?.noLoop();
      },
      renderFrame: () => {
        // enableRecordingMode makes incrementElapsedTime advance frame-based
        // time on each pre-draw, so a bare redraw steps exactly one frame.
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

    this.sketchRuntime?.getP5()?.loop();
    this.perfSample.paused = false;
    this.emitPerformanceSample();
  }

  pause(): void {
    this.sketchRuntime?.getP5()?.noLoop();
    this.perfSample.paused = true;
    this.emitPerformanceSample();
  }

  stop(): void {
    this.sketchRuntime?.getP5()?.noLoop();
    this.perfSample.paused = true;

    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = 0;
    }

    this.perfSample.rawSamples = [];
    this.perfSample.smoothedFps = 0;
    this.emitPerformanceSample();
  }

  seek( frame: number ): void {
    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = frame;
    }

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
    const framerate = animation?.framerate ?? 60;
    const duration = animation?.duration ?? 12;

    return Math.round( duration * framerate );
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

    return animation?.framerate ?? 60;
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
        const rawFps = typeof p.frameRate === "function"
          ? p.frameRate()
          : 0;

        if ( Number.isFinite( rawFps ) && rawFps > 0 ) {
          this.perfSample.rawSamples.push( rawFps );

          if ( this.perfSample.rawSamples.length > 20 ) {
            this.perfSample.rawSamples.shift();
          }
        }

        if ( now - this.perfSample.lastEmitTime >= 500 ) {
          const robustFps = this.getMedian( this.perfSample.rawSamples );

          if ( robustFps > 0 ) {
            this.perfSample.smoothedFps = this.perfSample.smoothedFps > 0
              ? this.perfSample.smoothedFps * 0.8 + robustFps * 0.2
              : robustFps;
          }

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
      fps: Number.isFinite( this.perfSample.smoothedFps )
        ? this.perfSample.smoothedFps
        : 0,
      paused: this.perfSample.paused,
      timestamp: performance.now()
    };

    this.emit(
      "performance",
      payload
    );
  }

  private getMedian( values: number[] ): number {
    if ( values.length === 0 ) {
      return 0;
    }

    const sorted = [
      ...values
    ].sort( this.compareNumbersAscending );
    const middle = Math.floor( sorted.length / 2 );

    if ( sorted.length % 2 === 0 ) {
      return ( sorted[ middle - 1 ] + sorted[ middle ] ) / 2;
    }

    return sorted[ middle ];
  }

  private compareNumbersAscending(
    a: number,
    b: number
  ): number {
    return a - b;
  }
}
