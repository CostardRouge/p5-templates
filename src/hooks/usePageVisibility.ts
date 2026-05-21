"use client";

import {
  useSyncExternalStore
} from "react";

// Single shared subscription: every consumer of the hook reads the same
// snapshot, and the app attaches at most one `visibilitychange` listener
// regardless of how many components subscribe.
const listeners = new Set<() => void>();
let isAttached = false;

function handleChange(): void {
  for ( const listener of listeners ) {
    listener();
  }
}

function subscribe( listener: () => void ): () => void {
  listeners.add( listener );

  if ( !isAttached && typeof document !== "undefined" ) {
    document.addEventListener(
      "visibilitychange",
      handleChange
    );
    isAttached = true;
  }

  return () => {
    listeners.delete( listener );

    if (
      listeners.size === 0 &&
      isAttached &&
      typeof document !== "undefined"
    ) {
      document.removeEventListener(
        "visibilitychange",
        handleChange
      );
      isAttached = false;
    }
  };
}

function getSnapshot(): boolean {
  if ( typeof document === "undefined" ) {
    return true;
  }

  return !document.hidden;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Whether the current tab/page is visible.
 *
 * Use this to pause expensive work (animations, looping videos, sketches,
 * polling, etc.) while the user is on another tab or has the window
 * minimized. Engine-agnostic and reusable across the whole app.
 *
 * SSR-safe: returns `true` during server rendering and initial hydration.
 */
export default function usePageVisibility(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}
