import {
  BaseSketchEngine
} from "@/engines/BaseSketchEngine";
import type {
  CaptureSource
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
  resolveSketchPath
} from "@/engines/metadata";
import {
  registerAnimationBridge,
  unregisterAnimationBridge
} from "@/lib/animationBridge";

// Type-only — the concrete runtime (which pulls in three.js + WebGL) is
// dynamically imported inside `init()` so it never lands in the server bundle
// or the sketch route's initial compile.
type ThreeRuntime = ( typeof import( "@/threejs/utils/sketch.js" ) )[ "default" ];

type SketchFns = {
  setupFn: ( ( ...args: any[] ) => any ) | null;
  drawFn: ( ( ...args: any[] ) => any ) | null;
};

/**
 * Three.js implementation of `SketchEngine`.
 *
 * Templates register `setup`/`draw` callbacks on the shared Three.js runtime;
 * this engine drives that runtime — mounting the WebGL renderer, running the
 * animation loop, and stepping frames deterministically for capture. Because
 * Three.js paints into a live `<canvas>`, it reuses the canvas `CaptureSource`
 * and canvas server-capture kind unchanged (same path as p5).
 */
export class ThreeEngine extends BaseSketchEngine {
  readonly engineId = "threejs";

  // ES modules are cached after first import, so a sketch module's top-level
  // `sketch.setup(...)`/`draw(...)` only runs on first visit. Cache the
  // resolved callbacks per sketch path and restore them on revisit — otherwise
  // returning to a previously-seen sketch would render the last sketch's
  // callbacks (identical fix to P5Engine).
  private static readonly sketchFnCache = new Map<string, SketchFns>();

  private runtime: ThreeRuntime | null = null;
  // Saved `window.setSlide` so switching back to a p5/GSAP sketch restores its
  // binding (mirrors GsapEngine — p5 registers the global once at module load).
  private previousSetSlide: ( ( index: number ) => void ) | undefined;

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    sketchName: string,
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

    if ( this.destroyed ) {
      return;
    }

    setSketchOptions(
      options,
      "react"
    );

    const sketchPath = resolveSketchPath(
      sketchName,
      "threejs"
    );

    const {
      default: sketch
    } = await import( "@/threejs/utils/sketch.js" );

    if ( this.destroyed ) {
      return;
    }

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
    if ( this.destroyed || !this.runtime || !sketchPath ) {
      return;
    }

    // Restore/cache the sketch's callbacks per path (see the static cache note).
    const runtime = this.runtime as any;
    const cached = ThreeEngine.sketchFnCache.get( sketchPath );

    if ( cached ) {
      runtime._setupFn = cached.setupFn;
      runtime._drawFn = cached.drawFn;
    } else {
      ThreeEngine.sketchFnCache.set(
        sketchPath,
        {
          setupFn: runtime._setupFn,
          drawFn: runtime._drawFn
        }
      );
    }

    await this.runtime.start( container );

    if ( this.destroyed || !this.runtime ) {
      return;
    }

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

    this.becomeReady();
  }

  protected teardown(): void {
    unregisterServerCaptureController();
    unregisterAnimationBridge();

    if ( typeof window !== "undefined" &&
      window.setSlide !== this.previousSetSlide ) {
      window.setSlide = this.previousSetSlide as ( index: number ) => void;
    }
    this.previousSetSlide = undefined;

    this.runtime?.reset();
    this.runtime = null;
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    super.updateOptions( partial );

    // Reflect the change immediately when the loop is paused.
    if ( this.runtime?.isPaused() ) {
      this.runtime.redraw();
    }
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
    this.reportStopped();
  }

  seek( frame: number ): void {
    // stepFrame renders synchronously into a renderer created with
    // preserveDrawingBuffer, so the frame is readable when this returns.
    this.runtime?.stepFrame( frame );
  }

  redraw(): void {
    this.runtime?.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  beginDeterministicCapture(): void {
    this.runtime?.enterRecordingMode();
  }

  endDeterministicCapture(): void {
    this.runtime?.exitRecordingMode();
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

  /* ---- performance ----------------------------------------------- */

  protected measureFps(): number {
    return this.runtime?.getMeasuredFps() ?? 0;
  }
}
