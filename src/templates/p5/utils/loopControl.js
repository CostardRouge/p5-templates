/**
 * Safe p5 draw-loop control.
 *
 * p5's `noLoop()` only flips an internal `_loop` flag — the
 * `requestAnimationFrame(_draw)` it scheduled on the previous frame stays
 * queued and fires one last time. If `loop()` runs *before* that trailing
 * frame fires, p5 ends up with two concurrent `_draw` chains: the one
 * `loop()` starts synchronously, plus the trailing rAF which reschedules
 * itself now that `_loop` is true again. Each extra chain makes the sketch
 * draw an extra time per browser frame, so the effective frame rate climbs
 * to a multiple of the target and the on-screen FPS readout becomes erratic,
 * shooting well past the configured framerate.
 *
 * Viewport gestures (pan / zoom / wheel) and tab-visibility changes pause and
 * resume the loop frequently, which makes this race trivial to hit. These
 * helpers preserve the invariant "at most one pending `_draw` rAF", so the
 * configured target frame rate is always respected.
 *
 * Always pause/resume the loop through these helpers — never call
 * `p.loop()` / `p.noLoop()` directly.
 */

function cancelPendingDraw( p ) {
  // `_requestAnimId` is the handle p5 stores for the next scheduled `_draw`.
  // Dropping it guarantees the trailing frame can't pair up with a fresh
  // chain on the next resume.
  if ( p._requestAnimId && typeof cancelAnimationFrame === "function" ) {
    cancelAnimationFrame( p._requestAnimId );
  }

  p._requestAnimId = 0;
}

/**
 * Stop the draw loop and drop the trailing frame p5 leaves scheduled.
 */
export function pauseLoop( p ) {
  if ( !p ) {
    return;
  }

  p.noLoop();
  cancelPendingDraw( p );
}

/**
 * Resume the draw loop without ever creating a second `_draw` chain.
 */
export function resumeLoop( p ) {
  if ( !p ) {
    return;
  }

  // Already looping: a single chain is live and p5's own `loop()` would be a
  // no-op, so leave it running rather than risk kicking a duplicate.
  if ( typeof p.isLooping === "function" && p.isLooping() ) {
    return;
  }

  // Clear any trailing frame before starting a fresh chain so we never run
  // two at once.
  cancelPendingDraw( p );
  p.loop();
}
