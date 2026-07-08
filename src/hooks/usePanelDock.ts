"use client";

import {
  useCallback, useSyncExternalStore
} from "react";

const STORAGE_KEY = "sketchbook:docked-workspace";
// Key used before the project was renamed from p5-templates — read once and
// migrated forward so users keep their saved layout.
const LEGACY_STORAGE_KEY = "p5-templates:docked-workspace";

const DEFAULT_DOCKED = false;

// Module-level store: the docked flag is read by separate React trees — the
// editor panels, the sketch viewport and the global menu bar (root layout) —
// which all render together off the same snapshot.
let docked: boolean = DEFAULT_DOCKED;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if ( hydrated || typeof window === "undefined" ) {
    return;
  }

  hydrated = true;

  try {
    let stored = localStorage.getItem( STORAGE_KEY );

    if ( stored === null ) {
      stored = localStorage.getItem( LEGACY_STORAGE_KEY );

      if ( stored === null ) {
        return;
      }

      // Migrate the legacy value forward, then drop the old key.
      localStorage.setItem(
        STORAGE_KEY,
        stored
      );
      localStorage.removeItem( LEGACY_STORAGE_KEY );
    }

    const parsed = JSON.parse( stored ) as unknown;

    if ( typeof parsed === "boolean" ) {
      docked = parsed;
    }
  } catch( error ) {
    console.warn(
      `Failed to read ${ STORAGE_KEY } from localStorage:`,
      error
    );
  }
}

function setDockedState( next: boolean ) {
  docked = next;

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

  return docked;
}

// Served during SSR and the hydration render; the persisted value applies on
// the first post-hydration read, so server and client markup always agree.
function getServerSnapshot(): boolean {
  return DEFAULT_DOCKED;
}

/** Test-only: reset the module-level store between test cases. */
export function __resetPanelDock() {
  docked = DEFAULT_DOCKED;
  hydrated = false;
}

/**
 * Whether the desktop template editor is in the docked "workspace" layout —
 * a squared, edge-to-edge chrome (top bar + left/right rails framing the
 * viewport) — versus the default floating layout of rounded islands.
 *
 * A single global flag, persisted in localStorage and shared across every
 * consumer: the editor panels, the sketch viewport, and the menu bar toggle
 * that switches modes. Desktop-only; callers gate the visual on their own
 * media query.
 */
export function usePanelDock() {
  const value = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setDocked = useCallback(
    ( next: boolean ) => setDockedState( next ),
    []
  );

  const toggleDocked = useCallback(
    () => setDockedState( !getSnapshot() ),
    []
  );

  return {
    docked: value,
    setDocked,
    toggleDocked
  };
}
