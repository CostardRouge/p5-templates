import type {
  SketchEngine,
  EngineEventName,
  EngineEventMap
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  resolveSketchPath
} from "@/engines/metadata";

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

  private _isReady = false;
  private container: HTMLElement | null = null;
  private sketchRuntime: P5SketchRuntime | null = null;
  private listeners = new Map<string, Set<( payload: any ) => void>>();

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

    await this.sketchRuntime.start( container );

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
    this.emit(
      "ready",
      undefined as any
    );
  }

  destroy(): void {
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
    this.sketchRuntime?.getP5()?.loop();
  }

  pause(): void {
    this.sketchRuntime?.getP5()?.noLoop();
  }

  stop(): void {
    this.sketchRuntime?.getP5()?.noLoop();

    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = 0;
    }
  }

  seek( frame: number ): void {
    const p = this.sketchRuntime?.getP5();

    if ( p ) {
      p.frameCount = frame;
    }

    this.sketchRuntime?.getP5()?.redraw();
  }

  /* ---- capture --------------------------------------------------- */

  async captureFrame( frame: number ): Promise<string> {
    this.seek( frame );

    // Allow one microtask for the draw cycle to complete.
    await new Promise( ( r ) => requestAnimationFrame( r ) );

    const canvas = this.getCanvas();

    if ( !canvas ) {
      throw new Error( "P5Engine: no canvas available for capture." );
    }

    return canvas.toDataURL( "image/png" );
  }

  getTotalFrames( options: SketchOption ): number {
    const framerate = options.animation?.framerate ?? 60;
    const duration = options.animation?.duration ?? 12;

    return Math.round( duration * framerate );
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.container?.querySelector( "canvas" ) ?? null;
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
  }

  off<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[ E ] ) => void
  ): void {
    this.listeners.get( event )?.delete( handler );
  }

  private emit<E extends EngineEventName>(
    event: E,
    payload: EngineEventMap[ E ]
  ): void {
    this.listeners.get( event )?.forEach( ( h ) => h( payload ) );
  }
}
