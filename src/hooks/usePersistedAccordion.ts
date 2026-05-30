"use client";

import {
  useCallback, useEffect, useState
} from "react";

/**
 * Persists the open/closed state of a set of accordion sections in
 * localStorage, keyed by section id.
 *
 * On first visit (nothing stored yet) the set returned by `getDefaultOpen`
 * is used — this lets callers auto-open "featured" sections while keeping the
 * rest collapsed for performance.
 *
 * Mirrors the hydration approach of `usePersistedViewMode`: the server and the
 * first client render share an empty (all-collapsed) state, then the stored /
 * default state is applied once mounted, so there is never a hydration
 * mismatch.
 */
export function usePersistedAccordion(
  storageKey: string,
  getDefaultOpen: () => string[]
) {
  const [
    openIds,
    setOpenIds
  ] = useState<Set<string>>( () => new Set() );
  const [
    hydrated,
    setHydrated
  ] = useState( false );

  // Load persisted state (or fall back to the default-open set) once mounted.
  useEffect(
    () => {
      let initial: string[] | null = null;

      try {
        const raw = window.localStorage.getItem( storageKey );

        if ( raw ) {
          const parsed = JSON.parse( raw );

          if ( Array.isArray( parsed ) ) {
            initial = parsed.filter( ( id ) => typeof id === "string" );
          }
        }
      } catch {
        // Ignore malformed / unavailable storage and use defaults.
      }

      setOpenIds( new Set( initial ?? getDefaultOpen() ) );
      setHydrated( true );
    },
    // getDefaultOpen is intentionally read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      storageKey
    ]
  );

  // Persist on change, but only after the initial hydration read so we never
  // clobber stored state with the transient empty set.
  useEffect(
    () => {
      if ( !hydrated ) {
        return;
      }

      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify( [
            ...openIds
          ] )
        );
      } catch {
        // Ignore storage write failures (private mode, quota, etc.).
      }
    },
    [
      openIds,
      hydrated,
      storageKey
    ]
  );

  const toggle = useCallback(
    ( id: string ) => {
      setOpenIds( ( prev ) => {
        const next = new Set( prev );

        if ( next.has( id ) ) {
          next.delete( id );
        } else {
          next.add( id );
        }

        return next;
      } );
    },
    []
  );

  const setOpen = useCallback(
    (
      id: string, open: boolean
    ) => {
      setOpenIds( ( prev ) => {
        if ( prev.has( id ) === open ) {
          return prev;
        }

        const next = new Set( prev );

        if ( open ) {
          next.add( id );
        } else {
          next.delete( id );
        }

        return next;
      } );
    },
    []
  );

  const isOpen = useCallback(
    ( id: string ) => openIds.has( id ),
    [
      openIds
    ]
  );

  return {
    isOpen,
    toggle,
    setOpen,
    hydrated
  };
}
