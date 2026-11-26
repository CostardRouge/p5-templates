import {
  useEffect, useSyncExternalStore
} from "react";

import {
  STOCKAGE_ENABLED
} from "./config";
import {
  getSession, type SesameSession, subscribeSession
} from "./session";
import {
  lastSyncedAt, syncNow
} from "./sync";

/**
 * The cloud sync as the page sees it: who is signed in, and how the last sync
 * went. A sync runs when a page opens, after the gallery changes (debounced),
 * when the tab is hidden, every five minutes while it is visible, and on «Sync
 * now». One module-level state, so every component reading it agrees.
 */

export type SyncState =
  | { phase: "idle";
    at: number | null }
  | { phase: "syncing";
    at: number | null }
  | { phase: "error";
    at: number | null;
    message: string };

const PERIOD_MS = 5 * 60_000;
const DEBOUNCE_MS = 4_000;
/** Settings that arrived at a page's opening reload it once per tab session; later ones wait for a click. */
const RELOADED_KEY = "sketchbook.stockage.reloaded";

let state: SyncState = {
  phase: "idle",
  at: null
};
let reloadWanted = false;
let postizPending = false;
const listeners = new Set<() => void>();

function set( next: SyncState ): void {
  state = next;
  for ( const listener of listeners ) {
    listener();
  }
}

function subscribe( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

export async function runSync( opening = false ): Promise<void> {
  if ( !getSession() ) {
    return;
  }
  set( {
    phase: "syncing",
    at: state.at ?? lastSyncedAt()
  } );
  try {
    const result = await syncNow();

    if ( result?.postizPending ) {
      postizPending = true;
    }
    if ( result?.reload ) {
      let reloaded = false;

      try {
        reloaded = sessionStorage.getItem( RELOADED_KEY ) === "1";
        sessionStorage.setItem(
          RELOADED_KEY,
          "1"
        );
      } catch {
        reloaded = true;
      }
      if ( opening && !reloaded ) {
        window.location.reload();

        return;
      }
      reloadWanted = true;
    }
    set( {
      phase: "idle",
      at: Date.now()
    } );
  } catch( error ) {
    set( {
      phase: "error",
      at: state.at,
      message: error instanceof Error ? error.message : String( error )
    } );
  }
}

const serverState: SyncState = {
  phase: "idle",
  at: null
};

export interface Stockage {
  enabled: boolean;
  session: SesameSession | null;
  sync: SyncState;
  /** Settings from another device were written: a reload shows them. */
  reloadWanted: boolean;
  /** Postiz settings arrived without a key: paste it in Publishing. */
  postizPending: boolean;
}

export function useStockage(): Stockage {
  const session = useSyncExternalStore(
    subscribeSession,
    getSession,
    () => null
  );
  const sync = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState
  );

  return {
    enabled: STOCKAGE_ENABLED,
    session,
    sync,
    reloadWanted,
    postizPending
  };
}

/** Mounted once per page (the menu): the automatic syncs. */
export function useStockageSync(): void {
  useEffect(
    () => {
      if ( !STOCKAGE_ENABLED ) {
        return;
      }

      let timer: number | undefined;
      const soon = () => {
        window.clearTimeout( timer );
        timer = window.setTimeout(
          () => void runSync(),
          DEBOUNCE_MS
        );
      };
      const onHidden = () => {
        if ( document.visibilityState === "hidden" ) {
          void runSync();
        }
      };
      const period = window.setInterval(
        () => {
          if ( document.visibilityState === "visible" ) {
            void runSync();
          }
        },
        PERIOD_MS
      );
      let unsubscribeGallery: ( () => void ) | null = null;
      let cancelled = false;

      void import( "@/lib/gallery/store" ).then( ( {
        getGalleryStore
      } ) => {
        if ( !cancelled ) {
          unsubscribeGallery = getGalleryStore().subscribe( soon );
        }
      } );
      document.addEventListener(
        "visibilitychange",
        onHidden
      );
      void runSync( true );

      return () => {
        cancelled = true;
        window.clearTimeout( timer );
        window.clearInterval( period );
        unsubscribeGallery?.();
        document.removeEventListener(
          "visibilitychange",
          onHidden
        );
      };
    },
    []
  );
}
