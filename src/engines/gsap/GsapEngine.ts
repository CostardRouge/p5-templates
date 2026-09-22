import type React from "react";
import {
  BaseSketchEngine
} from "@/engines/BaseSketchEngine";
import type {
  CaptureSource
} from "@/engines/recording/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  resolveSketchPath
} from "@/engines/metadata";
import {
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";
import nextFrame from "@/lib/export/nextFrame";

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
export class GsapEngine extends BaseSketchEngine {
  readonly engineId = "gsap";

  // The runtime already measures its achieved playback rate over a window, so
  // the sample is read more often and lightly smoothed rather than timed here.
  protected readonly performanceEmitIntervalMs = 250;

  private runtime: GsapRuntime | null = null;
  // Saved `window.setSlide` so switching back to a p5 sketch restores its
  // binding (p5 registers the global once at module load and never re-sets it).
  private previousSetSlide: ( ( index: number ) => void ) | undefined;
  private smoothedFps = 0;

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

    if ( this.destroyed ) {
      return;
    }

    setSketchOptions(
      options,
      "react"
    );

    const sketchPath = resolveSketchPath(
      sketchName,
      "gsap"
    );

    const runtimeModule = await import( "@/gsap/utils/runtime" );

    if ( this.destroyed ) {
      return;
    }

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

    // destroy() may have run while awaiting the dynamic imports.
    if ( this.destroyed || !this.runtime ) {
      return;
    }

    await this.runtime.start(
      container,
      component
    );

    if ( this.destroyed ) {
      return;
    }

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

    this.becomeReady();
  }

  protected teardown(): void {
    unregisterServerCaptureController();

    if ( typeof window !== "undefined" &&
      window.setSlide !== this.previousSetSlide ) {
      window.setSlide = this.previousSetSlide as ( index: number ) => void;
    }
    this.previousSetSlide = undefined;

    this.runtime?.reset();
    this.runtime = null;
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    this.runtime?.play();
    this.reportPlaying();
  }

  pause(): void {
    this.runtime?.pause();
    this.reportPaused();
  }

  stop(): void {
    this.runtime?.stop();
    this.smoothedFps = 0;
    this.reportStopped();
  }

  seek( frame: number ): void {
    this.runtime?.seekFrame( frame );
  }

  redraw(): void {
    this.runtime?.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  async seekAndDraw( frame: number ): Promise<void> {
    this.seek( frame );

    // A DOM surface: the GSAP-applied inline styles have to lay out before
    // the stage is rasterised, so this one does wait for a frame — raced
    // against a timer, so a hidden tab slows the export rather than hanging it.
    await nextFrame();
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

  /* ---- performance ----------------------------------------------- */

  protected measureFps(): number {
    const measured = this.runtime?.getMeasuredFps() ?? 0;

    this.smoothedFps = this.smoothedFps > 0
      ? this.smoothedFps * 0.6 + measured * 0.4
      : measured;

    return this.smoothedFps;
  }
}
