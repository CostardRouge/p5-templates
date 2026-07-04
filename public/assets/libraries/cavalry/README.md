# Cavalry Web Player runtime

This folder is the drop-in location for the **Cavalry Web Player** — the
self-hosted WebAssembly runtime that renders `.cv` scenes in the browser and
powers the `cavalry` engine (`src/engines/cavalry/`).

The runtime is **not** published to npm and is **not** committed to this repo
(it is a ~3 MB WASM payload). You download it from Cavalry and place its files
here.

## How to install

1. Get the Web Player package from the Cavalry docs:
   https://cavalry.studio/docs/web-player/
2. Copy its files into this folder so that the JS entry module resolves at:

   ```
   public/assets/libraries/cavalry/cavalry.js      ← entry (adjust name to match the package)
   public/assets/libraries/cavalry/cavalry.wasm    ← WASM module + any support files
   ```

   The entry URL the engine loads from is defined by `CAVALRY_PLAYER_URL` in
   `src/engines/cavalry/player/loadPlayer.ts` — keep them in sync.
3. In `src/engines/cavalry/player/loadPlayer.ts`, replace the stub body of
   `loadCavalryPlayer()` with the reference implementation kept in the comment
   directly beneath it (adjust the `Module` / `Player` / `Surface` API names to
   match the version you downloaded — see
   https://cavalry.studio/docs/web-player/api/).

## Until then

Without these files, `loadCavalryPlayer()` throws a clear "runtime not
installed" error and the engine degrades gracefully: the editor page, the
auto-generated form, and the `.cv` upload field all work — only the live render
shows a placeholder. This lets the whole integration (upload → options →
recording pipeline) be built and reviewed before the binary lands.
