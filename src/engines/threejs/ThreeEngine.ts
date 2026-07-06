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
  registerAnimationBridge,
  unregisterAnimationBridge,
  getAnimationBridge
} from "@/lib/animationBridge";

// Type-only — the concrete runtime (which pulls in three.js + WebGL) is
// dynamically imported inside `init()` so it never lands in the server bundle
// or the sketch route's initial compile.
type ThreeRuntime = ( typeof import( "@/threejs/utils/sketch.js" ) )[ "default" ];

/**
 * Three.js implementation of `SketchEngine`.
 *
 * Templates register `setup`/`draw` callbacks on the shared Three.js runtime;
 * this engine drives that runtime — mounting the WebGL renderer, running the
 * animation loop, and stepping frames deterministically for capture. Because
 * Three.js paints into a live `<canvas>`, it reuses the canvas `CaptureSource`
 * and canvas server-capture kind unchanged (same path as p5).
 */
export class ThreeEngine implements SketchEngine {
  readonly engineId = "threejs";

  // ES modules are cached after first import, so a sketch module's top-level
  // `sketch.setup(...)`/`draw(...)` only runs on first visit. Cache the
  // resolved callbacks per sketch path and restore them on revisit — otherwise
  // returning to a previously-seen sketch would render the last sketch's
  // callbacks (identical fix to P5Engine).
  private static readonly _sketchModuleCache = new Set<string>();
  private static readonly _sketchFnCache = new Map<string, {
    setupFn: ( ( ...args: any[] ) => any ) | null;
    drawFn: ( ( ...args: any[] ) => any ) | null;
  }>();

  private _isReady = false;
  private container: HTMLElement | null = null;
  private runtime: ThreeRuntime | null = null;
  private listeners = new Map<string, Set<( payload: any ) => void>>();
  private unsubscribeProgression: ( () => void ) | null = null;
  // Saved `window.setSlide` so switching back to a p5/GSAP sketch restores its
  // binding (mirrors GsapEngine — p5 registers the global once at module load).
  private previousSetSlide: ( ( index: number ) => void ) | undefined;

  private perfLoopId: number | null = null;
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

    container
      .querySelectorAll( "canvas" )
      .forEach( ( el ) => el.remove() );

    // Seed the shared options store so the sketch reads the same values (the
    // options-sync system, shared across engines).
    const {
      setSketchOptions
    } = await import( "@/lib/syncSketchOptions" );

    setSketchOptions(
      options,
      "react"
    );

    const sketchPath = resolveSketchPath(
      templatePath,
      "threejs"
    );

    const {
      default: sketch
    } = await import( "@/threejs/utils/sketch.js" );

    this.runtime = sketch as ThreeRuntime;

    // Loaded from the generated registry of literal dynamic imports — see the
    // note in P5Engine.init(). A variable-path import here would make the
    // bundler build a context module over every sketch.
    const {
      loadSketchModule
    } = await import( "@/generated/sketchModuleRegistry" );

    await loadSketchModule(
      "threejs",
      sketchPath
    ).catch( ( error ) => {
      this.emit(
        "error",
        error
      );
      throw error;
    } );

    // destroy() may have run while awaiting the dynamic imports.
    if ( !this.runtime || !sketchPath ) {
      return;
    }

    // Restore/cache the sketch's callbacks per path (see the static cache note).
    const runtime = this.runtime as any;

    if ( !ThreeEngine._sketchModuleCache.has( sketchPath ) ) {
      ThreeEngine._sketchModuleCache.add( sketchPath );
      ThreeEngine._sketchFnCache.set(
        sketchPath,
        {
          setupFn: runtime._setupFn,
          drawFn: runtime._drawFn
        }
      );
    } else {
      const cached = ThreeEngine._sketchFnCache.get( sketchPath );

      if ( cached ) {
        runtime._setupFn = cached.setupFn;
        runtime._drawFn = cached.drawFn;
      }
    }

    await this.runtime.start( container );

    if ( !this.runtime ) {
      return;
    }

    this._isReady = true;

    this.perfSample = {
      paused: false,
      fps: 0,
      lastEmitTime: performance.now()
    };

    // Expose progression to the shared UI (progression bar, scrubbing).
    registerAnimationBridge( {
      getProgression: () => this.runtime?.getProgression() ?? 0,
      setProgression: ( value ) => this.runtime?.setProgression( value ),
      pause: () => this.pause(),
      resume: () => this.play(),
      redraw: () => this.redraw(),
      subscribe: ( cb ) => this.runtime?.subscribeProgression( cb ) ?? ( () => undefined )
    } );

    // Uniform headless-capture controller: canvas pixels, stepped by frame.
    registerServerCaptureController( {
      captureKind: "canvas",
      surfaceSelector: "canvas.threejs-canvas",
      prepare: () => this.beginDeterministicCapture(),
      renderFrame: ( index ) => this.runtime?.stepFrame( index )
    } );

    // Expose the slide switch the shared UI + headless recorder call. p5 sets
    // this from its `slides` module; the Three.js runtime is the equivalent
    // here. Without it, switching slides never reaches the running sketch, so
    // the options accessor keeps merging the wrong (or no) per-slide overrides.
    if ( typeof window !== "undefined" ) {
      this.previousSetSlide = window.setSlide;
      window.setSlide = ( index: number ) => this.runtime?.setSlide( index );
    }

    this.emit(
      "ready",
      undefined as any
    );
  }

  destroy(): void {
    this.stopPerformanceLoop();
    unregisterServerCaptureController();
    unregisterAnimationBridge();

    if ( typeof window !== "undefined" &&
      window.setSlide !== this.previousSetSlide ) {
      window.setSlide = this.previousSetSlide as ( index: number ) => void;
    }
    this.previousSetSlide = undefined;

    this.unsubscribeProgression?.();
    this.unsubscribeProgression = null;

    this.runtime?.reset();
    this.runtime = null;

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

    // Reflect the change immediately when the loop is paused.
    if ( this.runtime?.isPaused() ) {
      this.runtime.redraw();
    }
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    this.runtime?.play();
    this.perfSample.paused = false;
    this.emitPerformanceSample();
  }

  pause(): void {
    this.runtime?.pause();
    this.perfSample.paused = true;
    this.emitPerformanceSample();
  }

  stop(): void {
    this.runtime?.stop();
    this.perfSample.paused = true;
    this.perfSample.fps = 0;
    this.emitPerformanceSample();
  }

  seek( frame: number ): void {
    this.runtime?.stepFrame( frame );
  }

  redraw(): void {
    this.runtime?.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  async captureFrame( frame: number ): Promise<string> {
    await this.seekAndDraw( frame );

    const canvas = this.getCanvas();

    if ( !canvas ) {
      throw new Error( "ThreeEngine: no canvas available for capture." );
    }

    return canvas.toDataURL( "image/png" );
  }

  async seekAndDraw( frame: number ): Promise<void> {
    this.runtime?.stepFrame( frame );

    // Allow one rAF so the composited frame is on the canvas before it's read.
    await new Promise( ( r ) => requestAnimationFrame( r ) );
  }

  async resetToStart(): Promise<void> {
    // Explicitly zero the clock — outside deterministic capture mode
    // (i.e. the realtime recording path) seekAndDraw(0) alone only pins the
    // *rendered* frame to 0 without resetting the elapsed-time clock that
    // free-runs on wall-clock, so a realtime recording would otherwise start
    // mid-loop instead of at phase 0. Mirrors P5Engine.resetToStart().
    getAnimationBridge()?.setProgression( 0 );
    await this.seekAndDraw( 0 );
  }

  beginDeterministicCapture(): void {
    this.runtime?.enterRecordingMode();
  }

  endDeterministicCapture(): void {
    this.runtime?.exitRecordingMode();
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
    return this.runtime?.getCanvas() ?? this.container?.querySelector( "canvas" ) ?? null;
  }

  getCaptureSource(): CaptureSource {
    const base = createCanvasCaptureSource( () => this.getCanvas() );

    return {
      get width() {
        return base.width;
      },
      get height() {
        return base.height;
      },
      getStreamCanvas: () => base.getStreamCanvas(),
      readFrame: () => base.readFrame(),
      // Realtime mode has no beginDeterministicCapture()/endDeterministicCapture()
      // hook (that pairing is async-loop-only), so this is where a realtime
      // recording of a transparent-background sketch gets the same
      // force-opaque treatment async-loop capture gets via enterRecordingMode().
      beginRealtime: () => {
        base.beginRealtime();
        this.runtime?.beginOpaqueCapture();
      },
      endRealtime: () => {
        base.endRealtime();
        this.runtime?.endOpaqueCapture();
      }
    };
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

      if ( this._isReady && now - this.perfSample.lastEmitTime >= 500 ) {
        this.perfSample.fps = this.runtime?.getMeasuredFps() ?? 0;
        this.perfSample.lastEmitTime = now;
        this.emitPerformanceSample();
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
