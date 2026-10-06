/**
 * Cavalry Web Player loader.
 *
 * Cavalry ships a self-hosted WebAssembly runtime (the "Web Player") that loads
 * `.cv` scene files and renders them to a WebGL/Skia surface via a deterministic
 * `setFrame(n)` → `render(surface)` model. That model is exactly what
 * {@link CavalryEngine} needs: frame-stepped, wall-clock-independent playback
 * that stays in sync between live preview and headless frame capture.
 *
 * The runtime is NOT published to npm and is NOT committed here (it is a
 * multi-megabyte WASM payload, and `/public/assets/libraries` is gitignored) —
 * it is downloaded from Cavalry and dropped into
 * `public/assets/libraries/cavalry/`. Until it is, {@link loadCavalryPlayer}
 * throws a clear, actionable error and the engine degrades to a placeholder,
 * keeping the editor and the `.cv` upload flow interactive.
 *
 * Documented flow this implements (Web Player is in beta — the loader probes
 * for the documented names and fails loudly rather than silently rendering
 * nothing if a future version renames them):
 *
 *   const Module  = await CavalryWasm( { locateFile, canvas } );
 *   Module.FS.writeFile( "scene.cv", new Uint8Array( bytes ) );
 *   const player  = Module.Cavalry.MakeWithPath( "scene.cv" );
 *   const surface = Module.makeWebGLSurfaceFromElement( canvas, w, h );
 *   player.setFrame( n ); player.render( surface );
 *
 * See `public/assets/libraries/cavalry/README.md` for install steps.
 */

/** Directory the vendored runtime lives in (trailing slash required). */
export const CAVALRY_PLAYER_DIR = "/assets/libraries/cavalry/";

/** Entry ES module of the vendored runtime. */
export const CAVALRY_PLAYER_URL = `${ CAVALRY_PLAYER_DIR }CavalryWasm.js`;

/** Path the scene is written to inside the runtime's virtual filesystem. */
const SCENE_PATH = "scene.cv";

const INSTALL_HINT =
  "Download the Web Player package from https://docs.cavalry.scenegroup.co/web-player/ " +
  `and copy its files into public/assets/libraries/cavalry/ (expected entry: ${ CAVALRY_PLAYER_URL }). ` +
  "See that folder's README.md.";

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
 *
 * Deliberately has no `play()` / `pause()`: the engine owns the animation loop
 * so that the live preview and a deterministic export step through exactly the
 * same `setFrame` → `render` path. Letting the runtime run its own loop would
 * put a second, wall-clock-driven clock on the same surface.
 */
export type CavalryPlayerHandle = {
  /** Load a `.cv` scene from its raw bytes and prepare it for rendering. */
  loadScene( bytes: ArrayBuffer ): Promise<void>;
  /** Move the playhead to `frame`, in the scene's own frame space. */
  setFrame( frame: number ): void;
  /** Draw the current frame to the surface. */
  render(): void;
  /** The canvas the scene renders into (handed to the recorder). */
  getCanvas(): HTMLCanvasElement;
  /** First frame of the composition's playback range (often not 0). */
  getStartFrame(): number;
  /** Last frame of the composition's playback range. */
  getEndFrame(): number;
  /** The composition's authored frame rate, or 0 when unknown. */
  getFPS(): number;
  /** Update a layer attribute at runtime (parameter binding). Optional. */
  setLayerAttribute?( layerId: string, attribute: string, value: unknown ): void;
  /** Release WASM/GL resources and detach the canvas. */
  dispose(): void;
};

/**
 * Import the runtime's ES module without the bundler trying to resolve it.
 *
 * The runtime is a *runtime* asset served from /public, not a build input, so a
 * plain `import()` would make webpack/Turbopack attempt (and fail) to bundle it
 * at compile time. Building the import through `new Function` hides the
 * specifier from static analysis in both bundlers, with no magic comments.
 */
async function importRuntime( url: string ): Promise<any> {
  const dynamicImport = new Function(
    "url",
    "return import( url );"
  ) as ( u: string ) => Promise<any>;

  return dynamicImport( url );
}

/** Resolve the Emscripten module factory from the vendored bundle. */
async function loadModuleFactory(): Promise<( config: unknown ) => Promise<any>> {
  // Some Emscripten builds also attach a global when loaded as a classic
  // script; prefer it when present so a script-tag install works too.
  const existing = ( window as any ).CavalryWasm;

  if ( typeof existing === "function" ) {
    return existing;
  }

  let mod: any;

  try {
    mod = await importRuntime( CAVALRY_PLAYER_URL );
  } catch( error ) {
    throw new Error( `Cavalry Web Player runtime not found. ${ INSTALL_HINT } (${ String( error ) })` );
  }

  const factory = mod?.default ?? mod?.CavalryWasm ?? ( window as any ).CavalryWasm;

  if ( typeof factory !== "function" ) {
    throw new Error( `Cavalry Web Player module at ${ CAVALRY_PLAYER_URL } did not export a module factory. ${ INSTALL_HINT }` );
  }

  return factory;
}

/** Call the first method on `target` whose name is in `names`. */
function callFirst(
  target: any,
  names: string[],
  fallback: number
): number {
  for ( const name of names ) {
    if ( typeof target?.[ name ] === "function" ) {
      const value = Number( target[ name ]() );

      if ( Number.isFinite( value ) ) {
        return value;
      }
    }
  }

  return fallback;
}

/**
 * Instantiate the Cavalry Web Player inside `container`.
 *
 * Throws with an actionable message when the runtime is absent (the normal
 * state of a fresh clone) or when its API does not match the documented shape.
 */
export async function loadCavalryPlayer( {
  container, width, height
}: CreatePlayerOptions ): Promise<CavalryPlayerHandle> {
  const canvas = document.createElement( "canvas" );

  canvas.width = width;
  canvas.height = height;
  canvas.className = "cavalry-canvas";
  canvas.style.maxWidth = "100%";
  canvas.style.maxHeight = "100%";
  container.appendChild( canvas );

  let wasm: any;

  try {
    const factory = await loadModuleFactory();

    // `canvas` is what Emscripten binds its GL context to; `locateFile` points
    // the loader at the sibling .wasm/.data files in the same folder.
    wasm = await factory( {
      canvas,
      locateFile: ( path: string ) => `${ CAVALRY_PLAYER_DIR }${ path }`
    } );
  } catch( error ) {
    canvas.remove();
    throw error;
  }

  if ( typeof wasm?.makeWebGLSurfaceFromElement !== "function" ) {
    canvas.remove();
    throw new Error( "Cavalry Web Player: makeWebGLSurfaceFromElement is missing from the loaded module. The Web Player API is in beta — check the vendored version against src/engines/cavalry/player/loadPlayer.ts." );
  }

  let player: any = null;
  let surface: any = null;

  return {
    async loadScene( bytes: ArrayBuffer ): Promise<void> {
      // The runtime reads the scene from its virtual filesystem, so the bytes
      // are written there first and the player is built from that path.
      wasm.FS.writeFile(
        SCENE_PATH,
        new Uint8Array( bytes )
      );

      const make = wasm.Cavalry?.MakeWithPath ?? wasm.Cavalry?.Make;

      if ( typeof make !== "function" ) {
        throw new Error( "Cavalry Web Player: neither Cavalry.MakeWithPath nor Cavalry.Make is available on the loaded module." );
      }

      player = make.call(
        wasm.Cavalry,
        SCENE_PATH
      );

      if ( !player ) {
        throw new Error( "Cavalry Web Player: the scene failed to load (Cavalry.Make returned nothing). The file may not be a valid .cv scene." );
      }

      surface = wasm.makeWebGLSurfaceFromElement(
        canvas,
        canvas.width,
        canvas.height
      );

      if ( !surface ) {
        throw new Error( "Cavalry Web Player: could not create a WebGL surface — the browser may not have a usable WebGL2 context." );
      }
    },

    setFrame( frame: number ): void {
      player?.setFrame( frame );
    },

    render(): void {
      if ( player && surface ) {
        player.render( surface );
      }
    },

    getCanvas: () => canvas,

    getStartFrame: () => callFirst(
      player,
      [
        "getStartFrame"
      ],
      0
    ),

    getEndFrame: () => callFirst(
      player,
      [
        "getEndFrame"
      ],
      0
    ),

    getFPS: () => callFirst(
      player,
      [
        "getFPS"
      ],
      0
    ),

    setLayerAttribute(
      layerId: string, attribute: string, value: unknown
    ): void {
      player?.setAttribute?.(
        layerId,
        attribute,
        value
      );
    },

    dispose(): void {
      // embind objects are not GC'd — they expose an explicit delete().
      try {
        surface?.delete?.();
        player?.delete?.();
      } catch {
        // A partially-constructed runtime may already be gone; nothing to do.
      }

      surface = null;
      player = null;
      canvas.remove();
    }
  };
}
