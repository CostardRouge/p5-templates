"use client";

import {
  useCallback, useSyncExternalStore
} from "react";

const STORAGE_KEY = "sketchbook:dev-actions";

const DEFAULT_VISIBLE = false;

/**
 * Dev affordances are a build-time capability AND a runtime preference, and the
 * two are kept apart on purpose.
 *
 * The store below is a plain persisted boolean — the preference. The build gate
 * is applied once, where the hook reads it out. `devActionsVisible` is therefore
 * `IS_DEV && preference`, which means a stale `true` in someone's localStorage
 * can never surface dev UI in a production bundle, while the store itself stays
 * ordinary enough to test.
 */
const IS_DEV = process.env.NODE_ENV === "development";

// Module-level store: the flag is read by separate React trees — the engine
// controls, the inspector's action bar, the export dialog and the global menu
// bar (root layout) — which all render together off the same snapshot. Same
// shape as usePanelDock, for the same reason.
let visible: boolean = DEFAULT_VISIBLE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if ( hydrated || typeof window === "undefined" ) {
    return;
  }

  hydrated = true;

  try {
    const stored = localStorage.getItem( STORAGE_KEY );

    if ( stored === null ) {
      return;
    }

    const parsed = JSON.parse( stored ) as unknown;

    if ( typeof parsed === "boolean" ) {
      visible = parsed;
    }
  } catch( error ) {
    console.warn(
      `Failed to read ${ STORAGE_KEY } from localStorage:`,
      error
    );
  }
}

function setVisibleState( next: boolean ) {
  visible = next;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify( next )
    );
  } catch( error ) {
    console.warn(
      `Failed to save ${ STORAGE_KEY } to localStorage:`,
      error
    );
  }

  listeners.forEach( ( listener ) => listener() );
}

function subscribe( listener: () => void ) {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

function getSnapshot(): boolean {
  hydrate();

  return visible;
}

// Served during SSR and the hydration render; the persisted value applies on
// the first post-hydration read, so server and client markup always agree.
function getServerSnapshot(): boolean {
  return DEFAULT_VISIBLE;
}

/** Test-only: reset the module-level store between test cases. */
export function __resetDevActions() {
  visible = DEFAULT_VISIBLE;
  hydrated = false;
}

/** The stored preference, before the build gate. Exported for tests. */
export function getDevActionsPreference(): boolean {
  return getSnapshot();
}

/** Set the stored preference and notify every consumer. Exported for tests. */
export function setDevActionsPreference( next: boolean ): void {
  setVisibleState( next );
}

export function subscribeDevActions( listener: () => void ): () => void {
  return subscribe( listener );
}

/**
 * Whether the studio's dev-only actions are currently on screen.
 *
 * They are scattered across four hosts — the pending badge and Debug/Pending
 * sections in the menu bar, the save-defaults / thumbnail / preview trio in the
 * inspector's action bar, the preview recorder in the export dialog, and the
 * camera's save-as-thumbnail double-click — and being permanently visible in
 * development made the studio impossible to screenshot, and impossible to read
 * as the finished product.
 *
 * Off by default: the studio looks like the shipped thing until you ask for the
 * tools. Toggled from the menu bar, persisted per browser.
 */
export function useDevActions() {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setDevActionsVisible = useCallback(
    ( next: boolean ) => setVisibleState( next ),
    []
  );

  const toggleDevActions = useCallback(
    () => setVisibleState( !getSnapshot() ),
    []
  );

  return {
    /** True only in development, and only while the flag is on. */
    devActionsVisible: IS_DEV && preference,
    /** True where the affordances exist at all — gates the menu toggle itself. */
    devActionsAvailable: IS_DEV,
    setDevActionsVisible,
    toggleDevActions
  };
}
