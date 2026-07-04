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

// `p.isLooping() === false` alone can't tell an explicitly paused sketch
// apart from one that's simply static (noLoop by design) — both look
// identical to callers outside this module. Track the explicit pause intent
// here, since every pause/resume path in the app (the playback controls and
// the loop-toggle shortcut) already funnels through these two functions.
const pausedInstances = new WeakMap();

/**
 * Stop the draw loop and drop the trailing frame p5 leaves scheduled.
 */
export function pauseLoop( p ) {
  if ( !p ) {
    return;
  }

  p.noLoop();
  cancelPendingDraw( p );
  pausedInstances.set(
    p,
    true
  );
}

/**
 * Resume the draw loop without ever creating a second `_draw` chain.
 */
export function resumeLoop( p ) {
  if ( !p ) {
    return;
  }

  pausedInstances.set(
    p,
    false
  );

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

/**
 * Whether `pauseLoop` was explicitly called and hasn't been followed by a
 * matching `resumeLoop` — as opposed to a sketch that's merely static
 * (noLoop by design) and has never been paused at all.
 */
export function isPaused( p ) {
  return Boolean( p && pausedInstances.get( p ) );
}
