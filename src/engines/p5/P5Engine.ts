import type {
  SketchEngine,
  EngineEventName,
  EngineEventMap,
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  resolveSketchPath
} from "@/engines/metadata";

/**
 * P5.js implementation of `SketchEngine`.
 *
 * It delegates to the existing p5 bootstrap files
 * (`src/p5-sketches/utils/sketch.js`, `engine/p5.js`, etc.) so the
 * actual drawing code remains unchanged.
 */
export class P5Engine implements SketchEngine {
  readonly engineId = "p5";

  private _isReady = false;
  private container: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private listeners = new Map<string, Set<( payload: any ) => void>>();

  get isReady(): boolean {
    return this._isReady;
  }

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    templatePath: string,
    options: SketchOption,
  ): Promise<void> {
    this.container = container;

    // Remove stale canvases from a previous run
    document
      .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
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

    // Watch for the canvas the p5 bootstrap appends to the body.
    const canvasAttached = new Promise<HTMLCanvasElement>( ( resolve ) => {
      const tryAttach = (): HTMLCanvasElement | null => {
        const canvas = document.querySelector( "canvas#defaultCanvas0", ) as HTMLCanvasElement | null;

        if ( canvas && this.container && !this.container.contains( canvas ) ) {
          this.container.appendChild( canvas );
        }

        return canvas;
      };

      // Already present?
      const existing = tryAttach();

      if ( existing ) {
        return resolve( existing );
      }

      this.observer = new MutationObserver( () => {
        const canvas = tryAttach();

        if ( canvas ) {
          this.observer?.disconnect();
          resolve( canvas );
        }
      } );

      this.observer.observe(
        document.body,
        {
          childList: true,
          subtree: true,
        }
      );
    } );

    // Dynamic-import the sketch module – the import triggers the
    // global p5 bootstrap (`sketch.setup()` → engine init → canvas
    // creation) exactly as the current P5Sketch.tsx does.
    const sketchPath = resolveSketchPath( templatePath, "p5" );

    await import(
      /* webpackInclude: /index\.js$/ */
      `@/p5/sketches/${ sketchPath }/index.js`
    ).catch( ( err ) => {
      this.emit(
        "error",
        err
      );
      throw err;
    } );

    await canvasAttached;
    this._isReady = true;
    this.emit(
      "ready",
undefined as any
    );
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;

    document
      .querySelectorAll( "canvas.p5Canvas, canvas#defaultCanvas0" )
      .forEach( ( el ) => el.remove() );

    ( window as any ).removeLoadedScripts?.();

    this._isReady = false;
    this.container = null;
    this.listeners.clear();
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    // Fires the same "sketch-options" CustomEvent the React UI uses.
    import( "@/lib/syncSketchOptions" ).then( ( {
      setSketchOptions
    } ) => setSketchOptions(
      partial,
      "react"
    ), );
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    ( window as any ).loop?.();
  }

  pause(): void {
    ( window as any ).noLoop?.();
  }

  stop(): void {
    ( window as any ).noLoop?.();

    // Reset to frame 0 (best-effort – p5 doesn't expose a clean API)
    if ( typeof ( window as any ).frameCount !== "undefined" ) {
      ( window as any ).frameCount = 0;
    }
  }

  seek( frame: number ): void {
    if ( typeof ( window as any ).frameCount !== "undefined" ) {
      ( window as any ).frameCount = frame;
    }

    ( window as any ).redraw?.();
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
    return document.querySelector( "canvas#defaultCanvas0" );
  }

  /* ---- events ---------------------------------------------------- */

  on<E extends EngineEventName>(
    event: E,
    handler: ( payload: EngineEventMap[E] ) => void,
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
    handler: ( payload: EngineEventMap[E] ) => void,
  ): void {
    this.listeners.get( event )?.delete( handler );
  }

  private emit<E extends EngineEventName>(
    event: E,
    payload: EngineEventMap[E],
  ): void {
    this.listeners.get( event )?.forEach( ( h ) => h( payload ) );
  }
}
