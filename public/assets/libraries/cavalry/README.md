# Cavalry Web Player runtime

This folder is the drop-in location for the **Cavalry Web Player** — the
self-hosted WebAssembly runtime that renders `.cv` scenes in the browser and
powers the `cavalry` engine (`src/engines/cavalry/`).

The runtime is **not** published to npm and is **not** committed to this repo
(it is a multi-megabyte WASM payload, and `/public/assets/libraries` is
gitignored — this README is force-added so the folder documents itself). You
download it from Cavalry and place its files here.

## Install

1. Get the Web Player package: <https://docs.cavalry.scenegroup.co/web-player/>
   (it is in **beta** — the API is subject to change).
2. Copy the runtime's files into this folder, so the entry module resolves at:

   ```
   public/assets/libraries/cavalry/CavalryWasm.js    ← entry ES module
   public/assets/libraries/cavalry/CavalryWasm.wasm  ← plus any sibling .wasm/.data files
   ```

   The loader passes `locateFile` pointing at this folder, so the sibling
   binaries are found automatically as long as they sit next to the entry.

3. That's it — there is no code change to make. `loadCavalryPlayer()` in
   `src/engines/cavalry/player/loadPlayer.ts` already implements the real
   integration and picks the runtime up on the next page load.

If your package names the entry differently, update `CAVALRY_PLAYER_URL` in
`loadPlayer.ts` (a classic-script install that sets a global `CavalryWasm` is
also detected).

## What the engine does with it

```js
const Module  = await CavalryWasm( { canvas, locateFile } );
Module.FS.writeFile( "scene.cv", new Uint8Array( bytes ) );  // uploaded .cv
const player  = Module.Cavalry.MakeWithPath( "scene.cv" );
const surface = Module.makeWebGLSurfaceFromElement( canvas, w, h );
player.setFrame( n );          // driven by the app's frame clock
player.render( surface );
```

The engine deliberately does **not** use the runtime's own playback loop: it
steps `setFrame` → `render` from the app's clock so the live preview and a
deterministic export produce identical frames. Frames are mapped across the
composition's real range (`getStartFrame()` … `getEndFrame()`), which is often
not zero-based because a composition carries an `inTime`.

## Until the files are here

`loadCavalryPlayer()` throws a clear "runtime not installed" error and the
engine degrades gracefully: the editor page, the auto-generated form, and the
`.cv` upload field all work — only the live render shows a placeholder saying
so.
