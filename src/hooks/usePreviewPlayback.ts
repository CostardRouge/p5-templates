"use client";

import {
  useCallback, useSyncExternalStore
} from "react";
import useMediaQuery from "@/hooks/useMediaQuery";

/**
 * How a sketch card's preview loop plays: while the card is in view, while the
 * pointer is over it, or never (the still thumbnail only).
 */
export type PreviewPlayback = "inview" | "hover" | "off";

export const PREVIEW_PLAYBACK_KEY = "sketchbook:preview-playback";

// The two-state switch this setting replaced stored a boolean under these.
const LEGACY_KEYS = [
  "sketchbook:animations-enabled",
  "templates-animations-enabled"
];

/** A screen that can hover: a mouse or a trackpad, not a finger. */
export const CAN_HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const MODES: readonly PreviewPlayback[] = [
  "inview",
  "hover",
  "off"
];

function isMode( value: unknown ): value is PreviewPlayback {
  return typeof value === "string" && ( MODES as readonly string[] ).includes( value );
}

/**
 * The mode a card plays in, from what the person stored (or nothing) and what
 * the screen can do.
 *
 * Nothing stored: a screen that can hover plays on hover, a touch screen shows
 * stills (every visible card decoding a video at once is too much for a phone),
 * and a system that asks for reduced motion shows stills everywhere. A stored
 * choice wins over all of that, except "hover" on a screen that cannot hover,
 * which would never play: it falls back to the default.
 */
export function resolvePreviewPlayback(
  stored: PreviewPlayback | null,
  {
    canHover,
    prefersReducedMotion
  }: {
    canHover: boolean;
    prefersReducedMotion: boolean;
  }
): PreviewPlayback {
  const fallback: PreviewPlayback = !prefersReducedMotion && canHover ? "hover" : "off";

  if ( stored === null || ( stored === "hover" && !canHover ) ) {
    return fallback;
  }

  return stored;
}

// Module-level store: every card on the page, the home page's and the header's
// control read the same value, and a change has to reach all of them at once.
// Same shape as useDevActions.
let stored: PreviewPlayback | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): PreviewPlayback | null {
  const raw = localStorage.getItem( PREVIEW_PLAYBACK_KEY );

  if ( raw !== null ) {
    const parsed = JSON.parse( raw ) as unknown;

    return isMode( parsed ) ? parsed : null;
  }

  // Carry the old switch over once: "off" was a choice worth keeping, "on" only
  // meant "not off", so it becomes the default rather than a pinned mode.
  for ( const key of LEGACY_KEYS ) {
    const legacy = localStorage.getItem( key );

    if ( legacy === null ) {
      continue;
    }

    const migrated = JSON.parse( legacy ) === false ? "off" : null;

    if ( migrated ) {
      localStorage.setItem(
        PREVIEW_PLAYBACK_KEY,
        JSON.stringify( migrated )
      );
    }

    LEGACY_KEYS.forEach( ( k ) => localStorage.removeItem( k ) );

    return migrated;
  }

  return null;
}

function hydrate() {
  if ( hydrated || typeof window === "undefined" ) {
    return;
  }

  hydrated = true;

  try {
    stored = readStorage();
  } catch( error ) {
    console.warn(
      `Failed to read ${ PREVIEW_PLAYBACK_KEY } from localStorage:`,
      error
    );
  }
}

function matches( query: string ): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia( query ).matches;
}

function notify() {
  listeners.forEach( ( listener ) => listener() );
}

function subscribe( listener: () => void ) {
  listeners.add( listener );

  // The resolved mode also moves with the screen: a mouse plugged into a
  // tablet, or reduced motion switched on in the system settings.
  const queries = typeof window.matchMedia === "function"
    ? [
      CAN_HOVER_QUERY,
      REDUCED_MOTION_QUERY
    ].map( ( q ) => window.matchMedia( q ) )
    : [];

  queries.forEach( ( mq ) => mq.addEventListener(
    "change",
    listener
  ) );

  return () => {
    listeners.delete( listener );
    queries.forEach( ( mq ) => mq.removeEventListener(
      "change",
      listener
    ) );
  };
}

function getSnapshot(): PreviewPlayback {
  hydrate();

  return resolvePreviewPlayback(
    stored,
    {
      canHover: matches( CAN_HOVER_QUERY ),
      prefersReducedMotion: matches( REDUCED_MOTION_QUERY )
    }
  );
}

// Nothing plays in the server render or the hydration render, so the markup
// agrees; the real mode applies on the first read after hydration.
function getServerSnapshot(): PreviewPlayback {
  return "off";
}

/** What the person chose, before the screen is taken into account. */
export function getStoredPreviewPlayback(): PreviewPlayback | null {
  hydrate();

  return stored;
}

export function setPreviewPlayback( next: PreviewPlayback ): void {
  stored = next;

  try {
    localStorage.setItem(
      PREVIEW_PLAYBACK_KEY,
      JSON.stringify( next )
    );
  } catch( error ) {
    console.warn(
      `Failed to save ${ PREVIEW_PLAYBACK_KEY } to localStorage:`,
      error
    );
  }

  notify();
}

export function subscribePreviewPlayback( listener: () => void ): () => void {
  return subscribe( listener );
}

/** Test-only: reset the module-level store between test cases. */
export function __resetPreviewPlayback() {
  stored = null;
  hydrated = false;
}

const noopSubscribe = () => () => {};

/**
 * The card preview setting, per browser. It replaced the `PREVIEW_ON_HOVER`
 * build flag and the two-state "Live previews" switch.
 */
export function usePreviewPlayback() {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const canHover = useMediaQuery( CAN_HOVER_QUERY );
  // False for the server and hydration renders, so a control can stay disabled
  // until it shows the person's real choice rather than the server default.
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const setMode = useCallback(
    ( next: PreviewPlayback ) => setPreviewPlayback( next ),
    []
  );

  return {
    mode,
    setMode,
    canHover,
    hydrated: isHydrated
  };
}
