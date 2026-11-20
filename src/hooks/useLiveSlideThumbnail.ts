"use client";

import {
  useCallback, useSyncExternalStore
} from "react";

export const LIVE_SLIDE_THUMBNAIL_KEY = "sketchbook:live-slide-thumbnail";

const DEFAULT_LIVE = true;

// Module-level store, the useDevActions shape: the menu item and every slide
// tile in the filmstrip render in separate trees off the same value.
let live: boolean = DEFAULT_LIVE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if ( hydrated || typeof window === "undefined" ) {
    return;
  }

  hydrated = true;

  try {
    const raw = localStorage.getItem( LIVE_SLIDE_THUMBNAIL_KEY );

    if ( raw === null ) {
      return;
    }

    const parsed = JSON.parse( raw ) as unknown;

    if ( typeof parsed === "boolean" ) {
      live = parsed;
    }
  } catch( error ) {
    console.warn(
      `Failed to read ${ LIVE_SLIDE_THUMBNAIL_KEY } from localStorage:`,
      error
    );
  }
}

function subscribe( listener: () => void ) {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

function getSnapshot(): boolean {
  hydrate();

  return live;
}

function getServerSnapshot(): boolean {
  return DEFAULT_LIVE;
}

export function getLiveSlideThumbnail(): boolean {
  return getSnapshot();
}

export function setLiveSlideThumbnail( next: boolean ): void {
  live = next;

  try {
    localStorage.setItem(
      LIVE_SLIDE_THUMBNAIL_KEY,
      JSON.stringify( next )
    );
  } catch( error ) {
    console.warn(
      `Failed to save ${ LIVE_SLIDE_THUMBNAIL_KEY } to localStorage:`,
      error
    );
  }

  listeners.forEach( ( listener ) => listener() );
}

export function subscribeLiveSlideThumbnail( listener: () => void ): () => void {
  return subscribe( listener );
}

/** Test-only: reset the module-level store between test cases. */
export function __resetLiveSlideThumbnail() {
  live = DEFAULT_LIVE;
  hydrated = false;
}

/**
 * Whether the active slide's filmstrip tile mirrors the canvas while it plays.
 * On by default; a per-browser choice from the menu's Workspace section. It
 * replaced the `LIVE_THUMBNAIL` build flag.
 */
export function useLiveSlideThumbnail() {
  const liveSlideThumbnail = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const toggleLiveSlideThumbnail = useCallback(
    () => setLiveSlideThumbnail( !getSnapshot() ),
    []
  );

  return {
    liveSlideThumbnail,
    toggleLiveSlideThumbnail
  };
}
