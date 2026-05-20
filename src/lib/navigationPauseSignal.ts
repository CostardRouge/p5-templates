let _callback: ( () => void ) | null = null;

/**
 * Register a function to call when the user navigates away from the current
 * page. Returns an unregister function.
 *
 * Only one callback is active at a time — the most recently registered one.
 * This is intentional: there is at most one running sketch on screen.
 */
export function registerNavigationPause( cb: () => void ): () => void {
  _callback = cb;

  return () => {
    if ( _callback === cb ) {
      _callback = null;
    }
  };
}

/**
 * Call from any navigation entry point (menu links, etc.) to pause the
 * active sketch before the new route starts rendering. No-op when no
 * sketch is registered.
 */
export function pauseSketchForNav(): void {
  _callback?.();
}
