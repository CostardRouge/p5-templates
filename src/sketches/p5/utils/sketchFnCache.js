// ── The setup/draw functions a sketch module registered, kept per path ──────
//
// A p5 sketch module registers its callbacks as a side effect of being
// imported (`sketch.setup( … )` / `sketch.draw( … )` at module top level). ES
// modules only ever evaluate once, so a second import registers nothing — the
// functions have to be remembered from the first one.
//
// Two consumers need exactly that, for two reasons, and they must share ONE
// cache:
//
//   - `P5Engine` restores them after a `reset()` cleared the runtime, so
//     navigating back to a sketch re-runs it instead of showing a blank canvas.
//   - `nestedSketch.js` needs them for a sketch it renders as a layer, which
//     may well be one the page already imported (the host embedding itself, or
//     a sketch visited earlier in the session).
//
// With two caches the second case silently fails open: the import is a no-op,
// the capture comes back empty, and the layer would run whatever functions the
// host happened to have installed — i.e. draw the host twice.

const cache = new Map();

export function hasSketchFns( sketchPath ) {
  return cache.has( sketchPath );
}

export function getSketchFns( sketchPath ) {
  return cache.get( sketchPath ) ?? null;
}

/**
 * Remember one sketch's registration. Ignores an entry with no draw function:
 * a failed or no-op import must not poison the cache for the real one.
 */
export function rememberSketchFns(
  sketchPath, fns
) {
  if ( !sketchPath || !fns?.drawFn ) {
    return;
  }

  cache.set(
    sketchPath,
    {
      setupFn: fns.setupFn ?? null,
      drawFn: fns.drawFn,
      sketchOptions: fns.sketchOptions
    }
  );
}
