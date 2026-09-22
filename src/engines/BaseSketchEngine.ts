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
  getAnimationBridge
} from "@/lib/animationBridge";
import {
  yieldToEventLoop
} from "@/lib/export/nextFrame";

/** How often a `performance` sample reaches the listeners while the loop runs. */
export const PERFORMANCE_EMIT_INTERVAL_MS = 500;

/**
 * What every rendering back-end shares, so a concrete engine is only the part
 * that differs: how it mounts, draws, seeks and reads its pixels.
 *
 * Owned here: the typed listener map; the `performance` sampling loop, which
 * runs only while someone listens and reports at a fixed cadence; the frame
 * maths every engine resolves through the same animation config; the default
 * capture surface and the capture waits (see `seekAndDraw`); and the
 * `destroyed` flag that `init()` re-checks after every await. That last one is
 * load-bearing: React strict mode (dev) mounts, destroys and re-mounts the
 * renderer synchronously, so a destroyed engine's still-pending init would
 * otherwise resume alongside the replacement's and start the shared runtime a
 * second time — two stacked canvases, doubled event handlers, capture reading
 * the dead one. A null-check on the runtime cannot catch it, because init
 * re-assigns the runtime itself right after the destroy ran.
 */
export abstract class BaseSketchEngine implements SketchEngine {
  abstract readonly engineId: string;

  protected _isReady = false;
  protected destroyed = false;
  protected container: HTMLElement | null = null;

  /** Cadence of the `performance` event; an engine may override it. */
  protected readonly performanceEmitIntervalMs: number = PERFORMANCE_EMIT_INTERVAL_MS;

  private listeners = new Map<string, Set<( payload: any ) => void>>();
  private perfLoopId: number | null = null;
  private perfPaused = false;
  private perfFps = 0;
  private perfLastEmitTime = 0;

  get isReady(): boolean {
    return this._isReady;
  }

  /* ---- lifecycle ------------------------------------------------- */

  abstract init(
    container: HTMLElement,
    sketchName: string,
    options: SketchOption,
  ): Promise<void>;

  destroy(): void {
    // Cancel any still-pending init (see the class note) before tearing the
    // runtime down.
    this.destroyed = true;

    this.stopPerformanceLoop();
    this.teardown();

    this._isReady = false;
    this.container = null;
    this.listeners.clear();
  }

  /** Engine-specific teardown: release the runtime, its globals and its DOM. */
  protected abstract teardown(): void;

  /**
   * Flip to ready and tell the listeners. The last thing `init()` does, once
   * the first frame is on screen and every controller is registered.
   */
  protected becomeReady(): void {
    this._isReady = true;
    this.perfPaused = false;
    this.perfFps = 0;
    this.perfLastEmitTime = performance.now();

    this.emit(
      "ready",
      undefined
    );
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    // The store is a client module: it stays a dynamic import so these engine
    // classes, whose registrations the server-rendered catalogue also reads,
    // never pull it into a server bundle.
    void import( "@/lib/syncSketchOptions" ).then( ( {
      setSketchOptions
    } ) => setSketchOptions(
      partial,
      "react"
    ) );
  }

  /* ---- playback -------------------------------------------------- */

  abstract play(): void;
  abstract pause(): void;
  abstract stop(): void;
  abstract redraw(): void;
  abstract seek( frame: number ): void;

  /* ---- capture --------------------------------------------------- */

  abstract beginDeterministicCapture(): void;
  abstract endDeterministicCapture(): void;
  abstract getCanvas(): HTMLCanvasElement | null;

  /**
   * The canvas contract: `seek()` has drawn the frame by the time it returns,
   * so all that is left is to hand the event loop back for one task — the
   * page paints the progress it was just told and takes the click on Stop.
   *
   * Deliberately NOT a wait for a display frame. A frame is not needed to
   * read a canvas whose drawing buffer is preserved (p5 and the Three.js
   * runtime both keep it), it would cap the export at the display's refresh
   * rate, and in a hidden tab it never comes at all — the export would hang
   * rather than slow down (`src/lib/export/nextFrame.ts`). The headless
   * recorder has always read the canvas straight after `renderFrame()` with
   * no frame in between; this is the same contract on the client. A DOM
   * engine, whose surface is only readable once the browser has laid it out,
   * overrides this with a frame wait that falls back to a timer.
   */
  async seekAndDraw( frame: number ): Promise<void> {
    this.seek( frame );
    await yieldToEventLoop();
  }

  async captureFrame( frame: number ): Promise<string> {
    await this.seekAndDraw( frame );

    const image = await this.getCaptureSource().readFrame();
    const canvas = image as Partial<HTMLCanvasElement>;

    if ( typeof canvas.toDataURL !== "function" ) {
      throw new Error( `${ this.engineId }: no canvas available for capture.` );
    }

    return canvas.toDataURL( "image/png" );
  }

  /**
   * Back to frame 0 on both clocks: the frame the seek pins AND the
   * progression the animation bridge drives. Outside deterministic capture
   * (the realtime recording path) `seekAndDraw( 0 )` alone only pins the
   * rendered frame, without resetting the elapsed-time clock that free-runs
   * on wall-clock — a realtime recording would then start mid-loop instead of
   * at phase 0.
   */
  async resetToStart(): Promise<void> {
    getAnimationBridge()?.setProgression( 0 );
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

  /** A canvas engine reads its live canvas; a DOM engine overrides this. */
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

  protected emit<E extends EngineEventName>(
    event: E,
    payload: EngineEventMap[ E ]
  ): void {
    this.listeners.get( event )?.forEach( ( h ) => h( payload ) );
  }

  /* ---- performance ----------------------------------------------- */

  /** The loop runs again: the next samples measure live playback. */
  protected reportPlaying(): void {
    this.perfPaused = false;
    this.emitPerformanceSample();
  }

  protected reportPaused(): void {
    this.perfPaused = true;
    this.emitPerformanceSample();
  }

  /** Stopped and rewound: paused, and the last reading no longer applies. */
  protected reportStopped(): void {
    this.perfPaused = true;
    this.perfFps = 0;
    this.emitPerformanceSample();
  }

  /**
   * Called on every animation frame while a `performance` listener exists and
   * the engine is ready — for an engine that derives its rate from a frame
   * counter and has to see that counter every frame. Nothing by default.
   */
  protected onPerformanceTick( _now: number ): void {
    // Nothing to observe per frame unless an engine says otherwise.
  }

  /** The rate to report, read once per emit interval. */
  protected abstract measureFps( now: number ): number;

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

      if ( this._isReady ) {
        this.onPerformanceTick( now );

        if ( now - this.perfLastEmitTime >= this.performanceEmitIntervalMs ) {
          this.perfFps = this.measureFps( now );
          this.perfLastEmitTime = now;
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
      fps: Number.isFinite( this.perfFps )
        ? this.perfFps
        : 0,
      paused: this.perfPaused,
      timestamp: performance.now()
    };

    this.emit(
      "performance",
      payload
    );
  }
}
