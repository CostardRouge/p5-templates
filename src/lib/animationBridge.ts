/**
 * Engine-agnostic animation bridge.
 *
 * Any sketch engine (p5.js, Three.js, GSAP, …) registers one
 * AnimationBridge implementation when it is ready. React components
 * subscribe to progression updates and invoke engine controls without
 * knowing which engine is running.
 *
 * Lifecycle:
 *   1. Engine calls `registerAnimationBridge(bridge)` once initialised.
 *   2. UI calls `onAnimationBridgeReady(cb)` to subscribe.
 *   3. Engine calls `unregisterAnimationBridge()` on teardown (optional).
 */

export interface AnimationBridge {
  /** Current animation progression normalised to [0, 1]. */
  getProgression(): number;

  /** Seek to a specific progression in [0, 1]. */
  setProgression( value: number ): void;

  /** Pause the engine draw loop. */
  pause(): void;

  /** Resume the engine draw loop. */
  resume(): void;

  /** Render one frame without resuming the loop (useful while scrubbing). */
  redraw(): void;

  /**
   * Subscribe to progression updates pushed by the engine's own draw loop.
   * The callback is called once per draw frame.
   * Returns an unsubscribe function.
   */
  subscribe( cb: ( progression: number ) => void ): () => void;
}

type ReadyCallback = ( bridge: AnimationBridge ) => ( () => void ) | void;

let current: AnimationBridge | null = null;
const pending: ReadyCallback[] = [];

/**
 * Called by an engine once it has fully initialised.
 * Fires any callbacks that were already waiting for a bridge.
 */
export function registerAnimationBridge( bridge: AnimationBridge ): void {
  current = bridge;

  for ( const cb of pending.splice( 0 ) ) {
    cb( bridge );
  }
}

/**
 * Removes the current bridge (e.g. when the sketch is torn down).
 */
export function unregisterAnimationBridge(): void {
  current = null;
}

/**
 * Calls `cb` immediately if a bridge is already registered, or defers the
 * call until one is. If `cb` returns a cleanup function it will be invoked
 * when the returned cancel/unsubscribe function is called.
 *
 * Returns a function that either:
 * - cancels a pending (not-yet-fired) registration, or
 * - invokes the cleanup returned by `cb` (i.e. unsubscribes).
 */
export function onAnimationBridgeReady( cb: ReadyCallback ): () => void {
  if ( current ) {
    const cleanup = cb( current );

    return () => cleanup?.();
  }

  pending.push( cb );

  return () => {
    const idx = pending.indexOf( cb );

    if ( idx !== -1 ) {
      pending.splice(
        idx,
        1
      );
    }
  };
}

/**
 * Returns the currently active bridge, or `null` if none is registered.
 */
export function getAnimationBridge(): AnimationBridge | null {
  return current;
}
