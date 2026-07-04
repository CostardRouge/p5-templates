"use client";

import {
  useCallback, useSyncExternalStore
} from "react";

/** The two desktop side panels that can be docked to a screen edge. */
export type PanelSide = "left" | "right";

export type PanelDockStates = Record<PanelSide, boolean>;

const STORAGE_KEY = "p5-templates:panel-dock";

const DEFAULT_STATES: PanelDockStates = {
  left: false,
  right: false
};

function isDockStates( value: unknown ): value is PanelDockStates {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof ( value as PanelDockStates ).left === "boolean" &&
    typeof ( value as PanelDockStates ).right === "boolean"
  );
}

// Module-level store: the dock state is shared across separate React trees —
// the editor panels, the sketch viewport and the global menu bar (root layout)
// all read the same snapshot and re-render together.
let state: PanelDockStates = DEFAULT_STATES;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if ( hydrated || typeof window === "undefined" ) {
    return;
  }

  hydrated = true;

  try {
    const stored = localStorage.getItem( STORAGE_KEY );

    if ( !stored ) {
      return;
    }

    const parsed = JSON.parse( stored ) as unknown;

    if ( isDockStates( parsed ) ) {
      state = parsed;
    }
  } catch( error ) {
    console.warn(
      `Failed to read ${ STORAGE_KEY } from localStorage:`,
      error
    );
  }
}

function setDockStates( next: PanelDockStates ) {
  state = next;

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

function getSnapshot(): PanelDockStates {
  hydrate();

  return state;
}

// Served during SSR and the hydration render; the persisted value applies on
// the first post-hydration read, so server and client markup always agree.
function getServerSnapshot(): PanelDockStates {
  return DEFAULT_STATES;
}

/** Test-only: clear the module-level store between test cases. */
export function __resetPanelDock() {
  state = DEFAULT_STATES;
  hydrated = false;
}

/**
 * Whether each desktop floating panel is docked flush to its screen side
 * (Figma-style) or left floating in the bottom corner. Persisted in
 * localStorage, keyed by side, and shared across every consumer — the panels
 * themselves, the sketch viewport (which reserves the rail widths) and the
 * menu bar's master toggle.
 */
export function usePanelDock() {
  const docked = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const toggleDock = useCallback(
    ( side: PanelSide ) => {
      setDockStates( {
        ...getSnapshot(),
        [ side ]: !getSnapshot()[ side ]
      } );
    },
    []
  );

  const setAllDocked = useCallback(
    ( dockedAll: boolean ) => {
      setDockStates( {
        left: dockedAll,
        right: dockedAll
      } );
    },
    []
  );

  return {
    docked,
    allDocked: docked.left && docked.right,
    toggleDock,
    setAllDocked
  };
}
