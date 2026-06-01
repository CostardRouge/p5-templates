/**
 * Lightweight tracker for media operations (video seeks, audio loads, …)
 * whose completion the engine may need to await before advancing to the
 * next frame in deterministic capture.
 *
 * Producers call `trackPendingMedia(promise)` whenever they kick off
 * something the engine should wait on; the recorder calls
 * `awaitPendingMedia()` between `seek` and `readFrame` so the canvas
 * actually reflects the seeked state.
 *
 * Settled promises are removed automatically, so the set stays small.
 */

const inFlight = new Set<Promise<unknown>>();

/**
 * Register a media-related promise. The same promise can be tracked more
 * than once; each registration is tracked independently.
 */
export function trackPendingMedia<T>( promise: Promise<T> ): Promise<T> {
  inFlight.add( promise );

  const remove = () => inFlight.delete( promise );

  promise.then(
    remove,
    remove
  );

  return promise;
}

/**
 * Resolves once every currently-tracked media promise has settled.
 * New promises tracked while awaiting are also waited on (the loop
 * keeps draining until the set is empty).
 */
export async function awaitPendingMedia(): Promise<void> {
  while ( inFlight.size > 0 ) {
    const snapshot = Array.from( inFlight );

    await Promise.allSettled( snapshot );
  }
}
