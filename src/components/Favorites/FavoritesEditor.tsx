"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from "react";
import clsx from "clsx";
import {
  Star
} from "lucide-react";

/**
 * The favourites editor (`docs/memory/sketches.md`), steevepommier.com's own
 * gesture brought to the sketch grid: **E** turns the grid into an editor, a
 * click on a card stars or unstars it instead of opening it, the changes pile
 * up in a tray at the foot of the screen, ⌘Z / Ctrl+Z takes the last one back
 * and Write sends the batch to the development server, which sets `favorite`
 * in each sketch's `sketch.json`. Nothing is written until Write.
 *
 * It exists in a development build only: the star is the repository's to
 * hold, and the public site is static — there, the stars are only shown.
 */

const ROUTE = "/api/dev/favorites";
const EDIT_KEY = "sketchbook.favorites.edit";

/** True where the editor can write: a development server. */
export const FAVORITES_EDITABLE = process.env.NODE_ENV !== "production";

interface FavoritesState {
  /** Whether this sketch wears a star now, pending changes counted. */
  isOn: ( key: string ) => boolean;
  isDirty: ( key: string ) => boolean;
  editing: boolean;
  toggle: ( key: string ) => void;
}

const FavoritesContext = createContext<FavoritesState | null>( null );

/** A sketch's star as the grid should draw it; outside the editor's provider, the catalogue's own value. */
export function useFavorite(
  key: string | null, saved: boolean
): { on: boolean;
  dirty: boolean;
  editing: boolean;
  toggle: () => void } {
  const state = useContext( FavoritesContext );

  return {
    on: state && key ? state.isOn( key ) : saved,
    dirty: Boolean( state && key && state.isDirty( key ) ),
    editing: Boolean( state?.editing && key ),
    toggle: () => {
      if ( state && key ) {
        state.toggle( key );
      }
    }
  };
}

/** The star a favourite wears on its picture; `ghost` is the editor's hint on a card not starred yet. */
export function FavoriteStar( {
  ghost = false, className
}: {
  ghost?: boolean;
  className?: string;
} ) {
  return (
    <span
      aria-hidden={ ghost }
      title={ ghost ? undefined : "Favourite" }
      data-favorite-star={ ghost ? "ghost" : "on" }
      className={ clsx(
        "pointer-events-none absolute left-1.5 top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full",
        ghost
          ? "border border-dashed border-foreground/50 bg-background/60 text-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          : "bg-foreground text-background shadow-sm",
        className
      ) }
    >
      <Star className={ clsx(
        "h-3.5 w-3.5",
        !ghost && "fill-current"
      ) }
      />
      {!ghost && <span className="sr-only">Favourite</span>}
    </span>
  );
}

function isTyping( target: EventTarget | null ): boolean {
  return target instanceof HTMLElement && ( target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test( target.tagName ) );
}

const TRAY_BUTTON = "inline-flex h-8 items-center rounded-full border border-background/35 px-3 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40";

export function FavoritesProvider( {
  saved, children
}: {
  /** The sketches starred in the catalogue, `<engine>/<name>` each. */
  saved: readonly string[];
  children: React.ReactNode;
} ) {
  const [
    written,
    setWritten
  ] = useState<ReadonlyMap<string, boolean>>( new Map() );
  const [
    pending,
    setPending
  ] = useState<ReadonlyMap<string, boolean>>( new Map() );
  const [
    editing,
    setEditing
  ] = useState( false );
  const [
    busy,
    setBusy
  ] = useState( false );
  const [
    message,
    setMessage
  ] = useState<string | null>( null );
  const history = useRef<string[]>( [] );
  const base = useMemo(
    () => new Set( saved ),
    [
      saved
    ]
  );
  // What is on disk: the catalogue as the page got it, then what this page wrote since.
  const onDisk = useCallback(
    ( key: string ) => written.has( key ) ? written.get( key )! : base.has( key ),
    [
      written,
      base
    ]
  );

  useEffect(
    () => {
      if ( !FAVORITES_EDITABLE ) {
        return;
      }
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the mode last left, known only in the browser
        setEditing( localStorage.getItem( EDIT_KEY ) === "1" );
      } catch {
        // Private mode: the mode lasts for the page.
      }
    },
    []
  );

  const toggle = useCallback(
    (
      key: string, record = true
    ) => {
      setPending( ( current ) => {
        const next = new Map( current );
        const now = current.has( key ) ? current.get( key )! : onDisk( key );

        // A flip back to what is on disk leaves the batch rather than queueing a no-op write.
        if ( !now === onDisk( key ) ) {
          next.delete( key );
        } else {
          next.set(
            key,
            !now
          );
        }

        return next;
      } );
      if ( record ) {
        history.current.push( key );
      }
      setMessage( null );
    },
    [
      onDisk
    ]
  );

  const write = useCallback(
    async() => {
      if ( !pending.size || busy ) {
        return;
      }

      const batch = new Map( pending );

      setBusy( true );
      try {
        const response = await fetch(
          ROUTE,
          {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify( {
              changes: Object.fromEntries( batch )
            } )
          }
        );
        const body = await response.json().catch( () => ( {} ) ) as { written?: number;
          error?: string; };

        if ( !response.ok ) {
          throw new Error( body.error ?? `HTTP ${ response.status }` );
        }

        setWritten( ( current ) => new Map( [
          ...current,
          ...batch
        ] ) );
        setPending( new Map() );
        history.current = [];
        setMessage( `Wrote ${ body.written ?? batch.size } ${ ( body.written ?? batch.size ) === 1 ? "file" : "files" } — commit them to ship the stars` );
      } catch( caught ) {
        setMessage( `Not written: ${ caught instanceof Error ? caught.message : String( caught ) }` );
      } finally {
        setBusy( false );
      }
    },
    [
      pending,
      busy
    ]
  );

  useEffect(
    () => {
      if ( !FAVORITES_EDITABLE ) {
        return;
      }

      const onKey = ( event: KeyboardEvent ) => {
        if ( isTyping( event.target ) || event.altKey ) {
          return;
        }

        const key = event.key.toLowerCase();

        if ( key === "z" && ( event.metaKey || event.ctrlKey ) && !event.shiftKey && editing ) {
          const last = history.current.pop();

          if ( last ) {
            event.preventDefault();
            toggle(
              last,
              false
            );
          }
        } else if ( key === "e" && !event.metaKey && !event.ctrlKey ) {
          setEditing( ( on ) => {
            try {
              localStorage.setItem(
                EDIT_KEY,
                on ? "0" : "1"
              );
            } catch {
              // Private mode.
            }

            return !on;
          } );
        }
      };
      const onLeave = ( event: BeforeUnloadEvent ) => {
        if ( pending.size ) {
          event.preventDefault();
        }
      };

      document.addEventListener(
        "keydown",
        onKey
      );
      window.addEventListener(
        "beforeunload",
        onLeave
      );

      return () => {
        document.removeEventListener(
          "keydown",
          onKey
        );
        window.removeEventListener(
          "beforeunload",
          onLeave
        );
      };
    },
    [
      editing,
      pending,
      toggle
    ]
  );

  const state = useMemo<FavoritesState>(
    () => ( {
      isOn: ( key ) => pending.has( key ) ? pending.get( key )! : onDisk( key ),
      isDirty: ( key ) => pending.has( key ),
      editing: FAVORITES_EDITABLE && editing,
      toggle
    } ),
    [
      pending,
      onDisk,
      editing,
      toggle
    ]
  );

  const adds = [
    ...pending.values()
  ].filter( Boolean ).length;
  const words = busy
    ? "Writing…"
    : pending.size
      ? `${ pending.size } ${ pending.size === 1 ? "change" : "changes" } · +${ adds } ★ −${ pending.size - adds }`
      : message ?? "Click a sketch to star it";

  return (
    <FavoritesContext.Provider value={ state }>
      {children}
      {FAVORITES_EDITABLE && editing && (
        <div
          role="region"
          aria-label="Favourites editor"
          data-favorites-tray
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-foreground py-1.5 pl-2 pr-2 text-xs text-background shadow-lg"
        >
          <span className="rounded-full bg-background px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">Favourites</span>
          <span className="min-w-0 truncate tabular-nums" data-favorites-message>{words}</span>
          <span className="whitespace-nowrap opacity-55 max-sm:hidden">E to leave · ⌘Z undo</span>
          <button
            type="button"
            className={ TRAY_BUTTON }
            disabled={ busy || !pending.size }
            onClick={ () => {
              setPending( new Map() );
              history.current = [];
            } }
          >
            Discard
          </button>
          <button
            type="button"
            className={ `${ TRAY_BUTTON } border-background bg-background !text-foreground` }
            disabled={ busy || !pending.size }
            data-favorites-write
            onClick={ () => void write() }
          >
            Write
          </button>
        </div>
      )}
    </FavoritesContext.Provider>
  );
}
