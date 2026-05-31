"use client";

import {
  useCallback, useEffect, useState
} from "react";

/**
 * Tracks an open/closed set of section ids (e.g. which category rows are
 * expanded from a horizontal carousel into a full grid), optionally persisted
 * in localStorage keyed by `storageKey`.
 *
 * @param storageKey      localStorage key used when `persist` is true.
 * @param getDefaultOpen  ids open on first visit (read once on mount).
 * @param persist         when false, state lives only in memory — nothing is
 *                        read from or written to localStorage. Flip this to
 *                        opt out of cross-visit memory without touching the
 *                        call sites' logic.
 *
 * Hydration: server and the first client render share the default set, then
 * the persisted set (if any) is applied after mount, mirroring
 * `usePersistedViewMode` so there is never a hydration mismatch.
 */
export function usePersistedAccordion(
  storageKey: string,
  getDefaultOpen: () => string[],
  persist = true
) {
  const [
    openIds,
    setOpenIds
  ] = useState<Set<string>>( () => new Set() );
  const [
    hydrated,
    setHydrated
  ] = useState( false );

  // Resolve the initial state once mounted: persisted set when available and
  // enabled, otherwise the caller-provided defaults.
  useEffect(
    () => {
      let initial: string[] | null = null;

      if ( persist ) {
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
      }

      setOpenIds( new Set( initial ?? getDefaultOpen() ) );
      setHydrated( true );
    },
    // getDefaultOpen is intentionally read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      storageKey,
      persist
    ]
  );

  // Persist on change — only when enabled and after the initial hydration read,
  // so we never clobber stored state with the transient empty set.
  useEffect(
    () => {
      if ( !persist || !hydrated ) {
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
      persist,
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
