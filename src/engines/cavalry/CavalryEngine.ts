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
  createCanvasCaptureSource
} from "@/engines/recording/captureSource";
import {
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";
import {
  loadCavalryPlayer, type CavalryPlayerHandle
} from "./player/loadPlayer";

/**
 * Shape of a Cavalry sketch module (`src/templates/cavalry/sketches/…/index.js`).
 *
 * A Cavalry animation is a `.cv` scene, not code. Two sources are supported:
 *  - `scene` set to an asset path → a committed scene shipped with the repo.
 *  - `scene` null → the generic uploader; the scene is read at runtime from
 *    `options.sketch.cavalryFile` (a user-uploaded `.cv`).
 */
type CavalrySketchModule = {
  scene?: string | null;
};

/**
 * Cavalry implementation of `SketchEngine`.
 *
 * Drives the Cavalry Web Player (a self-hosted WASM runtime) which renders a
 * `.cv` scene to a real WebGL canvas. Playback and capture are deterministic:
 * the app's frame clock is the source of truth (identical to `GsapEngine`), and
 * each frame is mapped onto the scene via `player.setFrame()` → `render()`.
 *
 * When the Web Player bundle is not vendored (see `player/loadPlayer.ts`), the
 * engine degrades to a placeholder canvas + `error` event without breaking the
 * page — the editor and `.cv` upload flow stay fully interactive.
 */
export class CavalryEngine implements SketchEngine {
  readonly engineId = "cavalry";

  private _isReady = false;
  // Set by destroy(). init() re-checks it after every await: React strict
  // mode (dev) mounts, destroys and re-mounts the renderer synchronously, so
  // a destroyed engine's still-pending init would otherwise resume alongside
  // the replacement's and append a SECOND canvas to the shared container —
  // two stacked players, with capture reading the dead one. Clearing stale
  // canvases at the top of init() cannot catch it: both inits get past that
  // clear before either has appended anything.
  private destroyed = false;
  private container: HTMLElement | null = null;
  private player: CavalryPlayerHandle | null = null;
  private placeholderCanvas: HTMLCanvasElement | null = null;
  private options: SketchOption | null = null;
  private deterministic = false;
  private listeners = new Map<string, Set<( payload: any ) => void>>();

  // Live-preview clock, in app frames (fractional between rAF ticks).
  private playhead = 0;
  private playLoopId: number | null = null;
  private perfLoopId: number | null = null;
  private perfSample = {
    paused: true,
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
    this.options = options;

    // Remove stale canvases from a previous run
    container
      .querySelectorAll( "canvas" )
      .forEach( ( el ) => el.remove() );

    // Seed the shared options store so any live parameter binding reads the
    // same values (mirrors the p5 / gsap engines).
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

    const {
      size
    } = getEffectiveSlideSettings( options );

    const sketchPath = resolveSketchPath(
      templatePath,
      "cavalry"
    );

    let scenePath: string | null | undefined;

    if ( sketchPath ) {
      const {
        loadSketchModule
      } = await import( "@/generated/sketchModuleRegistry" );

      if ( this.destroyed ) {
        return;
      }

      const templateModule = await loadSketchModule(
        "cavalry",
        sketchPath
      ).catch( () => null );

      if ( this.destroyed ) {
        return;
      }

      const mod = ( templateModule?.default ?? templateModule ) as CavalrySketchModule | null;

      scenePath = mod?.scene;
    }

    // Uploaded scene takes over when the template doesn't ship one.
    scenePath = scenePath ?? ( options.sketch as Record<string, any> | undefined )?.cavalryFile;

    await this.loadPlayerAndScene(
      container,
      size.width,
      size.height,
      scenePath ?? null
    );

    if ( this.destroyed ) {
      return;
    }

    this._isReady = true;

    // Uniform headless-capture controller (canvas-based, like p5).
    registerServerCaptureController( {
      captureKind: "canvas",
      surfaceSelector: "canvas.cavalry-canvas",
      prepare: () => this.beginDeterministicCapture(),
      renderFrame: ( index ) => this.renderFrame( index )
    } );

    this.emit(
      "ready",
      undefined as any
    );
  }

  private async loadPlayerAndScene(
    container: HTMLElement,
    width: number,
    height: number,
    scenePath: string | null
  ): Promise<void> {
    if ( !scenePath ) {
      // Generic uploader with nothing uploaded yet — show a prompt.
      this.drawPlaceholder(
        container,
        width,
        height,
        "Upload a Cavalry (.cv) file to preview it here"
      );

      return;
    }

    try {
      const player = await loadCavalryPlayer( {
        container,
        width,
        height
      } );

      // The player mounts its own canvas, so a destroyed engine must dispose
      // it rather than return — otherwise it outlives us in the container.
      if ( this.destroyed ) {
        player.dispose();

        return;
      }

      const {
        resolveAssetURL
      } = await import( "@/lib/assets/resolveAssetURL" );

      const url = resolveAssetURL(
        scenePath,
        this.options?.id
      );
      const response = await fetch( url );

      if ( !response.ok ) {
        throw new Error( `Failed to fetch Cavalry scene (${ response.status }) from ${ url }` );
      }

      const bytes = await response.arrayBuffer();

      await player.loadScene( bytes );

      if ( this.destroyed ) {
        player.dispose();

        return;
      }

      player.getCanvas().classList.add( "cavalry-canvas" );

      this.player = player;
    } catch( error ) {
      // Stub / load failure: keep the page usable and report through the
      // engine event bus rather than rejecting init().
      this.drawPlaceholder(
        container,
        width,
        height,
        "Cavalry Web Player runtime not installed — see public/assets/libraries/cavalry/README.md"
      );
      console.error(
        "[CavalryEngine] player unavailable:",
        error
      );
      this.emit(
        "error",
        error instanceof Error ? error : new Error( String( error ) )
      );
    }
  }

  /** Render a labelled 2D placeholder when no player/scene is available. */
  private drawPlaceholder(
    container: HTMLElement,
    width: number,
    height: number,
    message: string
  ): void {
    // Reached from init() after several awaits — a destroyed engine must not
    // append anything to a container the replacement engine already owns.
    if ( this.destroyed ) {
      return;
    }

    const canvas = document.createElement( "canvas" );

    canvas.width = width;
    canvas.height = height;
    canvas.className = "cavalry-placeholder cavalry-canvas";
    canvas.style.maxWidth = "100%";
    canvas.style.maxHeight = "100%";

    const ctx = canvas.getContext( "2d" );

    if ( ctx ) {
      ctx.fillStyle = "#111118";
      ctx.fillRect(
        0,
        0,
        width,
        height
      );
      ctx.fillStyle = "#8a8a99";
      ctx.font = `${ Math.round( Math.min(
        width,
        height
      ) * 0.03 ) }px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        message,
        width / 2,
        height / 2
      );
    }

    container.appendChild( canvas );
    this.placeholderCanvas = canvas;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPlaybackLoop();
    this.stopPerformanceLoop();
    unregisterServerCaptureController();

    this.player?.dispose();
    this.player = null;

    this.placeholderCanvas?.remove();
    this.placeholderCanvas = null;

    this._isReady = false;
    this.container = null;
    this.options = null;
    this.deterministic = false;
    this.listeners.clear();
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    this.options = {
      ...( this.options ?? {} ),
      ...partial
    } as SketchOption;

    import( "@/lib/syncSketchOptions" ).then( ( {
      setSketchOptions
    } ) => setSketchOptions(
      partial,
      "react"
    ) );

    this.redraw();
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    this.startPlaybackLoop();
    this.perfSample.paused = false;
    this.emitPerformanceSample();
  }

  pause(): void {
    this.stopPlaybackLoop();
    this.perfSample.paused = true;
    this.emitPerformanceSample();
  }

  stop(): void {
    this.stopPlaybackLoop();
    this.playhead = 0;
    this.renderFrame( 0 );
    this.perfSample.paused = true;
    this.emitPerformanceSample();
  }

  /**
   * Drive live preview from our own clock.
   *
   * The runtime can play a scene by itself, but that is a second wall-clock
   * timeline on the same surface: it would ignore the app's duration/framerate
   * and drift from what an export produces. Instead the loop converts elapsed
   * time into an app frame and pushes it through the very same `renderFrame`
   * the deterministic capture path uses, so preview and export agree by
   * construction.
   */
  private startPlaybackLoop(): void {
    if ( this.playLoopId !== null || !this.player ) {
      return;
    }

    const fps = this.options ? this.getFrameRate( this.options ) : 60;
    const total = this.options ? this.getTotalFrames( this.options ) : 0;
    let last = performance.now();

    const tick = ( now: number ) => {
      if ( this.destroyed || this.deterministic ) {
        this.playLoopId = null;

        return;
      }

      this.playhead += ( ( now - last ) / 1000 ) * fps;
      last = now;

      if ( total > 0 ) {
        this.playhead %= total;
      }

      this.renderFrame( Math.floor( this.playhead ) );
      this.playLoopId = requestAnimationFrame( tick );
    };

    this.playLoopId = requestAnimationFrame( tick );
  }

  private stopPlaybackLoop(): void {
    if ( this.playLoopId === null ) {
      return;
    }

    cancelAnimationFrame( this.playLoopId );
    this.playLoopId = null;
  }

  seek( frame: number ): void {
    this.renderFrame( frame );
  }

  redraw(): void {
    this.player?.render();
  }

  /**
   * Map an app frame index onto the loaded scene and render it.
   *
   * The app's animation config owns duration + frame rate (so a Cavalry clip
   * loops in lock-step with every other engine). The app frame becomes
   * normalized progress, which is then mapped across the composition's own
   * playback range.
   *
   * That range is NOT assumed to start at 0: a composition carries an `inTime`,
   * so `getStartFrame()` is commonly non-zero and rendering `progress * count`
   * would show the wrong part of the scene (or nothing at all).
   */
  private renderFrame( appFrame: number ): void {
    if ( !this.player ) {
      return;
    }

    const total = this.options ? this.getTotalFrames( this.options ) : 0;
    const start = this.player.getStartFrame();
    const end = this.player.getEndFrame();

    let sceneFrame = appFrame;

    if ( total > 1 && end > start ) {
      const progress = Math.min(
        Math.max(
          appFrame / ( total - 1 ),
          0
        ),
        1
      );

      sceneFrame = Math.round( start + progress * ( end - start ) );
    }

    this.player.setFrame( sceneFrame );
    this.player.render();
  }

  /* ---- capture --------------------------------------------------- */

  async captureFrame( frame: number ): Promise<string> {
    await this.seekAndDraw( frame );

    const canvas = this.getCanvas();

    if ( !canvas ) {
      throw new Error( "CavalryEngine: no canvas available for capture." );
    }

    return canvas.toDataURL( "image/png" );
  }

  async seekAndDraw( frame: number ): Promise<void> {
    this.renderFrame( frame );

    // Allow one frame for the WebGL surface to flush before it is read back.
    await new Promise( ( r ) => requestAnimationFrame( r ) );
  }

  async resetToStart(): Promise<void> {
    this.renderFrame( 0 );
  }

  beginDeterministicCapture(): void {
    this.deterministic = true;
    // Stop the preview loop so frames come only from the recorder's seeks.
    this.stopPlaybackLoop();
  }

  endDeterministicCapture(): void {
    this.deterministic = false;
  }

  getRecordingCapabilities(
    _options: SketchOption,
    _slideIndex?: number
  ): RecorderCapabilities {
    return {
      supportsDeterministicCapture: true,
      // WebGL read-back per frame is async, so the deterministic loop is the
      // natural default (realtime is still offered).
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
    return this.player?.getCanvas() ?? this.placeholderCanvas ?? null;
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

      if ( now - this.perfSample.lastEmitTime >= 250 ) {
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
    const fps = this.perfSample.paused || this.deterministic
      ? 0
      : this.options
        ? this.getFrameRate( this.options )
        : 0;

    const payload: EnginePerformanceSample = {
      fps,
      paused: this.perfSample.paused,
      timestamp: performance.now()
    };

    this.emit(
      "performance",
      payload
    );
  }
}
