/**
 * Cavalry Web Player loader.
 *
 * Cavalry ships a self-hosted WebAssembly runtime (the "Web Player", ~3 MB)
 * that loads `.cv` scene files and renders them to a WebGL canvas via a
 * deterministic `setFrame(n)` → `render()` model. That model is exactly what
 * {@link CavalryEngine} needs: frame-stepped, wall-clock-independent playback
 * that stays in sync between live preview and headless frame capture.
 *
 * The runtime is NOT published to npm — it is downloaded from Cavalry and
 * vendored into `public/assets/libraries/cavalry/`. Until those files are in
 * place, {@link loadCavalryPlayer} throws a clear, actionable error and the
 * engine degrades gracefully to a "player not installed" placeholder (the
 * editor + upload flow stay fully interactive).
 *
 * See `public/assets/libraries/cavalry/README.md` for exactly which files to
 * drop in and how to enable the real loader below.
 */

/** Where the vendored Web Player entry module is expected to live. */
export const CAVALRY_PLAYER_URL = "/assets/libraries/cavalry/cavalry.js";

export type CreatePlayerOptions = {
  /** Element the player canvas is mounted into. */
  container: HTMLElement;
  /** Render surface width in pixels. */
  width: number;
  /** Render surface height in pixels. */
  height: number;
};

/**
 * Thin handle over the Cavalry Web Player, exposing only what the engine drives.
 * The concrete implementation wraps the vendored `Module` / `Player` / `Surface`
 * trio documented at https://cavalry.studio/docs/web-player/api/ .
 */
export type CavalryPlayerHandle = {
  /** Load a `.cv` scene from its raw bytes and prepare it for rendering. */
  loadScene( bytes: ArrayBuffer ): Promise<void>;
  /** Move the playhead to `frame` (in the scene's own frame space). */
  setFrame( frame: number ): void;
  /** Draw the current frame to the surface/canvas. */
  render(): void;
  /** Start / stop the player's internal playback loop (live preview only). */
  play(): void;
  pause(): void;
  stop(): void;
  /** The canvas the scene renders into (handed to the recorder). */
  getCanvas(): HTMLCanvasElement;
  /** Total frames in the loaded scene, or 0 when no scene is loaded. */
  getFrameCount(): number;
  /** The scene's authored frame rate, or 0 when unknown. */
  getFrameRate(): number;
  /** Update a layer attribute at runtime (parameter binding). Optional. */
  setLayerAttribute?( layerId: string, attribute: string, value: unknown ): void;
  /** Release WASM/GL resources and detach the canvas. */
  dispose(): void;
};

/**
 * Instantiate the Cavalry Web Player inside `container`.
 *
 * STUB: throws until the Web Player bundle is vendored. Swap the body for the
 * commented reference implementation below once the files are present.
 */

export async function loadCavalryPlayer( _options: CreatePlayerOptions ): Promise<CavalryPlayerHandle> {
  throw new Error( "Cavalry Web Player runtime is not installed. Download the Web Player " +
      "package from https://cavalry.studio/docs/web-player/ and drop its files " +
      "into public/assets/libraries/cavalry/ (see that folder's README.md), " +
      "then enable the loader in src/engines/cavalry/player/loadPlayer.ts." );

  /*
   * ---- Reference implementation (enable once the bundle is vendored) -------
   *
   * The vendored `cavalry.js` exports a factory that instantiates the WASM
   * module. The exact surface is documented at
   * https://cavalry.studio/docs/web-player/api/ — adjust the names to match the
   * version you download.
   *
   *   const { container, width, height } = _options;
   *   const canvas = document.createElement( "canvas" );
   *   canvas.width = width;
   *   canvas.height = height;
   *   canvas.className = "cavalry-canvas";
   *   container.appendChild( canvas );
   *
   *   const CavalryWasm = ( await import(
   *     /* webpackIgnore: true *\/ CAVALRY_PLAYER_URL
   *   ) ).default;
   *   const module = await CavalryWasm();
   *   const surface = module.makeWebGLSurfaceFromElement( canvas, width, height );
   *
   *   let sceneFrameCount = 0;
   *   let sceneFrameRate = 0;
   *
   *   return {
   *     async loadScene( bytes ) {
   *       const scene = module.loadScene( new Uint8Array( bytes ) );
   *       sceneFrameCount = scene.getFrameCount?.() ?? 0;
   *       sceneFrameRate = scene.getFrameRate?.() ?? 0;
   *       module.setFrame( 0 );
   *       module.render( surface );
   *     },
   *     setFrame: ( frame ) => module.setFrame( frame ),
   *     render: () => module.render( surface ),
   *     play: () => module.play?.(),
   *     pause: () => module.pause?.(),
   *     stop: () => module.stop?.(),
   *     getCanvas: () => canvas,
   *     getFrameCount: () => sceneFrameCount,
   *     getFrameRate: () => sceneFrameRate,
   *     setLayerAttribute: ( id, attr, value ) => module.setLayerAttribute?.( id, attr, value ),
   *     dispose: () => {
   *       module.destroy?.();
   *       canvas.remove();
   *     }
   *   };
   */
}
