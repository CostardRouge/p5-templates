import {
  BaseSketchEngine
} from "@/engines/BaseSketchEngine";
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
  registerServerCaptureController,
  unregisterServerCaptureController
} from "@/engines/recording/serverCapture";
import {
  FrameRateMeter
} from "@/engines/frameRateMeter";
import {
  loadCavalryPlayer, type CavalryPlayerHandle
} from "./player/loadPlayer";

/**
 * Shape of a Cavalry sketch module (`src/sketches/cavalry/sketches/…/index.js`).
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
 * Drives the Cavalry Web Player (a self-hosted WASM runtime, see
 * `player/loadPlayer.ts`) which renders a `.cv` scene to a WebGL surface.
 * Because it paints into a live `<canvas>`, it keeps the base class's canvas
 * `CaptureSource` and capture waits unchanged (same path as p5 and Three.js).
 *
 * When the runtime is not vendored the engine degrades to a placeholder canvas
 * plus an `error` event without breaking the page — the editor and the `.cv`
 * upload flow stay fully interactive.
 */
export class CavalryEngine extends BaseSketchEngine {
  readonly engineId = "cavalry";

  private player: CavalryPlayerHandle | null = null;
  private placeholderCanvas: HTMLCanvasElement | null = null;
  private options: SketchOption | null = null;
  private deterministic = false;

  // Live-preview clock, in app frames (fractional between rAF ticks).
  private playhead = 0;
  private playLoopId: number | null = null;

  // Frames this engine actually rendered; the rate is derived from deltas of
  // that counter rather than a runtime-reported instantaneous fps.
  private framesRendered = 0;
  private perfMeter = new FrameRateMeter();

  /* ---- lifecycle ------------------------------------------------- */

  async init(
    container: HTMLElement,
    sketchName: string,
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
      sketchName,
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

      const sketchModule = await loadSketchModule(
        "cavalry",
        sketchPath
      ).catch( () => null );

      if ( this.destroyed ) {
        return;
      }

      const mod = ( sketchModule?.default ?? sketchModule ) as CavalrySketchModule | null;

      scenePath = mod?.scene;
    }

    // Uploaded scene takes over when the sketch doesn't ship one.
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

    this.perfMeter.reset();

    // Uniform headless-capture controller (canvas-based, like p5).
    registerServerCaptureController( {
      captureKind: "canvas",
      surfaceSelector: "canvas.cavalry-canvas",
      prepare: () => this.beginDeterministicCapture(),
      renderFrame: ( index ) => this.renderFrame( index )
    } );

    this.becomeReady();
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
      this.renderFrame( 0 );
    } catch( error ) {
      // Missing runtime / load failure: keep the page usable and report through
      // the engine event bus rather than rejecting init().
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

  protected teardown(): void {
    this.stopPlaybackLoop();
    unregisterServerCaptureController();

    this.player?.dispose();
    this.player = null;

    this.placeholderCanvas?.remove();
    this.placeholderCanvas = null;

    this.options = null;
    this.deterministic = false;
  }

  /* ---- options --------------------------------------------------- */

  updateOptions( partial: Partial<SketchOption> ): void {
    this.options = {
      ...( this.options ?? {} ),
      ...partial
    } as SketchOption;

    super.updateOptions( partial );
    this.redraw();
  }

  /* ---- playback -------------------------------------------------- */

  play(): void {
    this.startPlaybackLoop();
    this.reportPlaying();
  }

  pause(): void {
    this.stopPlaybackLoop();
    this.reportPaused();
  }

  stop(): void {
    this.stopPlaybackLoop();
    this.playhead = 0;
    this.renderFrame( 0 );
    this.reportStopped();
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
    // Keep the preview clock with the scrub, so resuming continues from where
    // the playhead was dropped rather than snapping back.
    this.playhead = frame;
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
    this.framesRendered++;
  }

  /* ---- capture --------------------------------------------------- */

  beginDeterministicCapture(): void {
    this.deterministic = true;
    // Stop the preview loop so frames come only from the recorder's seeks.
    this.stopPlaybackLoop();
  }

  endDeterministicCapture(): void {
    this.deterministic = false;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.player?.getCanvas() ?? this.placeholderCanvas ?? null;
  }

  /* ---- performance ----------------------------------------------- */

  protected measureFps( now: number ): number {
    return this.perfMeter.sample(
      now,
      this.framesRendered
    );
  }
}
