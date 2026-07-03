import {
  useCallback, useEffect, useState
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

/**
 * Remembers whether each desktop floating panel is docked flush to its screen
 * side (Figma-style) or left floating in the bottom corner. Persisted in
 * localStorage, keyed by side.
 *
 * The stored value is read after mount (not during the initial render) so the
 * server-rendered markup and the first client render always agree — avoiding a
 * hydration mismatch — then snaps to the persisted preference.
 */
export function usePanelDock() {
  const [
    docked,
    setDocked
  ] = useState<PanelDockStates>( DEFAULT_STATES );

  useEffect(
    () => {
      try {
        const stored = localStorage.getItem( STORAGE_KEY );

        if ( !stored ) {
          return;
        }

        const parsed = JSON.parse( stored ) as unknown;

        if ( isDockStates( parsed ) ) {
          setDocked( parsed );
        }
      } catch( error ) {
        console.warn(
          `Failed to read ${ STORAGE_KEY } from localStorage:`,
          error
        );
      }
    },
    []
  );

  const toggleDock = useCallback(
    ( side: PanelSide ) => {
      setDocked( ( prev ) => {
        const next = {
          ...prev,
          [ side ]: !prev[ side ]
        };

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

        return next;
      } );
    },
    []
  );

  return {
    docked,
    toggleDock
  };
}
