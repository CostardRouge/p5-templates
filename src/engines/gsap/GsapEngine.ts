import type React from "react";
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
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";

// Type-only — does NOT pull the client-only runtime (react-dom/gsap) into the
// server bundle. The real module is dynamically imported inside `init()`.
type GsapRuntime = ( typeof import( "@/gsap/utils/runtime" ) )[ "default" ];
type TemplateComponent = React.ComponentType<{ options: Record<string, any> }>;

/**
 * GSAP / HTML implementation of `SketchEngine`.
 *
 * Templates are `.jsx` React components animated with GSAP. The engine mounts
 * them via the GSAP runtime, scrubs a paused timeline off a frame clock for
 * deterministic playback + capture, and exposes a DOM-backed `CaptureSource`
 * so the same recorder that drives p5 works here unchanged.
 */
export class GsapEngine implements SketchEngine {
  readonly engineId = "gsap";

  private _isReady = false;
  private container: HTMLElement | null = null;
  private runtime: GsapRuntime | null = null;
  private listeners = new Map<string, Set<( payload: any ) => void>>();
  // Saved `window.setSlide` so switching back to a p5 sketch restores its
  // binding (p5 registers the global once at module load and never re-sets it).
  private previousSetSlide: ( ( index: number ) => void ) | undefined;

  private perfLoopId: number | null = null;
  private perfSample = {
    paused: false,
    smoothedFps: 0,
    lastEmitTime: 0
  };

  get isReady(): boolean {
    return this._isReady;
  }

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    sketchName: string,
    options: SketchOption
  ): Promise<void> {
    this.container = container;

    container.querySelectorAll( ".gsap-stage, .gsap-mirror-canvas" )
      .forEach( ( el ) => el.remove() );

    // Seed the shared options store so the runtime + template read the same
    // values (the options-sync system, shared with p5).
    const {
      setSketchOptions
    } = await import( "@/lib/syncSketchOptions" );

    setSketchOptions(
      options,
      "react"
    );

    const sketchPath = resolveSketchPath(
      sketchName,
      "gsap"
    );

    const runtimeModule = await import( "@/gsap/utils/runtime" );

    this.runtime = runtimeModule.default;

    // Loaded from the generated registry of literal dynamic imports — see
    // src/generated/sketchModuleRegistry.ts. A variable-path import here would
    // make the bundler build a context module over every sketch. The registry
    // module is imported dynamically (rather than at the top of the file) so
    // its ~270 literal import() code-split points are NOT registered on the
    // sketch page's initial compile — they only cost compile time once a sketch
    // actually mounts and calls init().
    const {
      loadSketchModule
    } = await import( "@/generated/sketchModuleRegistry" );

    const templateModule = await loadSketchModule(
      "gsap",
      sketchPath
    ).catch( ( error ) => {
      this.emit(
        "error",
        error
      );
      throw error;
    } );

    const component = ( templateModule.default ?? templateModule ) as TemplateComponent;

    await this.runtime.start(
      container,
      component
    );

    this._isReady = true;

    registerServerCaptureController( {
      captureKind: "dom",
      surfaceSelector: "[data-capture-surface]",
      prepare: () => this.beginDeterministicCapture(),
      renderFrame: ( index: number ) => this.runtime?.seekFrame( index )
    } );

    // Expose the slide switch the shared UI + headless recorder call. p5 sets
    // this from its `slides` module; the GSAP runtime is the equivalent here.
    // Without it, multi-slide GSAP recordings hung on `[data-slide="N"]` and
    // played only a fraction of each slide's animation.
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

    if ( typeof window !== "undefined" &&
      window.setSlide !== this.previousSetSlide ) {
      window.setSlide = this.previousSetSlide as ( index: number ) => void;
    }
    this.previousSetSlide = undefined;

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
    this.perfSample.smoothedFps = 0;
    this.emitPerformanceSample();
  }

  seek( frame: number ): void {
    this.runtime?.seekFrame( frame );
  }

  redraw(): void {
    this.runtime?.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  async captureFrame( frame: number ): Promise<string> {
    await this.seekAndDraw( frame );

    const canvas = await this.runtime?.rasterize();

    if ( !canvas ) {
      throw new Error( "GsapEngine: no canvas available for capture." );
    }

    return canvas.toDataURL( "image/png" );
  }

  async seekAndDraw( frame: number ): Promise<void> {
    this.runtime?.seekFrame( frame );

    // Allow one rAF for the GSAP-applied inline styles to lay out.
    await new Promise( ( r ) => requestAnimationFrame( r ) );
  }

  async resetToStart(): Promise<void> {
    await this.runtime?.resetToStart();
  }

  beginDeterministicCapture(): void {
    // The GSAP timeline is already scrubbed off a frame clock, so the only
    // thing recording mode changes here is that progression stops wrapping
    // (clamped to [0, 1]) for the duration of the capture.
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
      // DOM rasterisation is async, so the deterministic loop is the natural
      // default for this engine (realtime is still offered).
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
    return this.runtime?.getMirrorCanvas() ?? null;
  }

  getCaptureSource(): CaptureSource {
    const runtime = this.runtime;

    return {
      get width() {
        return runtime?.getMirrorCanvas()?.width ?? 0;
      },
      get height() {
        return runtime?.getMirrorCanvas()?.height ?? 0;
      },
      getStreamCanvas: () => runtime?.getMirrorCanvas() ?? null,
      readFrame: async() => {
        if ( !runtime ) {
          throw new Error( "GsapEngine: runtime not ready for capture." );
        }

        return runtime.rasterize();
      },
      beginRealtime: () => runtime?.beginRealtimeMirror(),
      endRealtime: () => runtime?.stopMirrorLoop()
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

      // The runtime already measures the achieved playback fps (actual frame
      // steps per second, which tracks the configured framerate) over a window,
      // so we just sample + lightly smooth it rather than timing rAF callbacks.
      if ( now - this.perfSample.lastEmitTime >= 250 ) {
        const measured = this.runtime?.getMeasuredFps() ?? 0;

        this.perfSample.smoothedFps = this.perfSample.smoothedFps > 0
          ? this.perfSample.smoothedFps * 0.6 + measured * 0.4
          : measured;

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
}
