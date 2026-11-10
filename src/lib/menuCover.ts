import {
  useSyncExternalStore
} from "react";

/**
 * Whether a surface that owns the whole screen covers the global menu button.
 *
 * The menu bar lives in the root layout, outside the sketch page's tree, so a
 * full-screen surface down there (the phone's Export dialog) cannot reach it
 * through props: it says so here, and `MenuBar` hides its floating button
 * while any cover is held. A module singleton like `presentationMode.ts`, for
 * the same reason. The button is hidden, never unmounted: the menu bar also
 * owns the Publishing dialog the Export dialog opens (`openPublishing`).
 *
 * A counter, not a flag, so two covers cannot release each other.
 */

let covers = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for ( const listener of listeners ) {
    listener();
  }
}

/** Cover the menu button until the returned release is called (once; extra calls do nothing). */
export function coverMenu(): () => void {
  let released = false;

  covers += 1;
  notify();

  return () => {
    if ( released ) {
      return;
    }

    released = true;
    covers -= 1;
    notify();
  };
}

export function isMenuCovered(): boolean {
  return covers > 0;
}

export function subscribeMenuCover( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

/** Live: true while a full-screen surface covers the menu button; false on the server. */
export function useMenuCovered(): boolean {
  return useSyncExternalStore(
    subscribeMenuCover,
    isMenuCovered,
    () => false
  );
}
