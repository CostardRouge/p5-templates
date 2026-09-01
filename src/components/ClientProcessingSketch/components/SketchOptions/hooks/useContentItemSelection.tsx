"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import type {
  CollapsibleSection
} from "./useCollapsibleStates";
import {
  CONTENT_ITEM_SELECT_EVENT
} from "../constants/drawer-events";

/**
 * Bridges an on-canvas content-item press (dispatched by contentDrag.js as the
 * `CONTENT_ITEM_SELECT_EVENT` window event) to the options panel: it switches
 * to the owning slide, opens the content section, and publishes the item's
 * path — which the layers panel reads to open that layer's inspector.
 *
 * Two moving parts:
 *  - the CONTEXT holds the currently-selected item path + a monotonically
 *    increasing nonce (so re-selecting the same item re-triggers the effect).
 *    Items read it via useContentSelection().
 *  - the LISTENER hook wires the window event to the collapsible + slide
 *    machinery. It lives in a component rendered inside both CollapsibleProvider
 *    and ContentSelectionProvider (see SketchOptions).
 */

// The path segment identifying a content list, derived from a drag scope.
function scopeToBase( scope: string ): {
  base: string;
  section: CollapsibleSection;
  slideIndex?: number;
} | null {
  if ( scope === "global" ) {
    return {
      base: "content",
      section: "content"
    };
  }

  const match = /^slide:(\d+)$/.exec( scope );

  if ( !match ) {
    return null;
  }

  const slideIndex = Number( match[ 1 ] );

  return {
    base: `slides.${ slideIndex }.content`,
    section: "content",
    slideIndex
  };
}

type Selection = {
  path: string;
  nonce: number;
};

type ContentSelectionValue = {
  selection: Selection | null;
  selectPath: ( path: string | null ) => void;
};

const ContentSelectionContext = createContext<ContentSelectionValue | null>( null );

export function ContentSelectionProvider( {
  children
}: {
  children: ReactNode;
} ) {
  const [
    selection,
    setSelection
  ] = useState<Selection | null>( null );

  const nonceRef = useRef( 0 );

  const selectPath = useCallback(
    ( path: string | null ) => {
      if ( path === null ) {
        setSelection( null );

        return;
      }

      nonceRef.current += 1;
      setSelection( {
        path,
        nonce: nonceRef.current
      } );
    },
    []
  );

  const value = useMemo(
    () => ( {
      selection,
      selectPath
    } ),
    [
      selection,
      selectPath
    ]
  );

  return (
    <ContentSelectionContext.Provider value={ value }>
      {children}
    </ContentSelectionContext.Provider>
  );
}

/** Read the current selection (for an item to decide whether to reveal itself). */
export function useContentSelection(): Selection | null {
  return useContext( ContentSelectionContext )?.selection ?? null;
}

/**
 * Select a layer, or clear the selection with `null`.
 *
 * The same channel serves the canvas (through the window event below) and the
 * layers list, so pressing an object on the sketch and pressing its row open
 * the very same inspector.
 */
export function useSelectContentPath(): ( path: string | null ) => void {
  const context = useContext( ContentSelectionContext );

  return context?.selectPath ?? ( () => {} );
}

type ListenerOptions = {
  setSection: ( section: CollapsibleSection, expanded: boolean ) => void;
  onSelectSlide: ( index: number | undefined ) => void;
  activeSlideIndex: number | undefined;
};

/**
 * Subscribe to the canvas selection event and reveal the pressed item. Call
 * from a component mounted inside CollapsibleProvider + ContentSelectionProvider.
 */
export function useContentSelectionListener( {
  setSection,
  onSelectSlide,
  activeSlideIndex
}: ListenerOptions ) {
  const context = useContext( ContentSelectionContext );
  const selectPath = context?.selectPath;

  // Keep the latest callbacks in a ref so the window listener is registered
  // once and never misses an update (the handler reads current values).
  const latest = useRef( {
    setSection,
    onSelectSlide,
    activeSlideIndex,
    selectPath
  } );

  latest.current = {
    setSection,
    onSelectSlide,
    activeSlideIndex,
    selectPath
  };

  useEffect(
    () => {
      const handler = ( event: Event ) => {
        const detail = ( event as CustomEvent ).detail as {
          scope?: string;
          index?: number | string;
        } | undefined;

        if ( !detail?.scope ) {
          return;
        }

        const resolved = scopeToBase( detail.scope );

        if ( !resolved ) {
          return;
        }

        const {
          base,
          section,
          slideIndex
        } = resolved;
        const api = latest.current;

        // Switch to the owning slide first so its content list mounts.
        if ( slideIndex !== undefined && slideIndex !== api.activeSlideIndex ) {
          api.onSelectSlide( slideIndex );
        }

        // Open the enclosing zone (lazy-mounted until expanded).
        api.setSection(
          section,
          true
        );

        // Non-numeric index (the montage title) is not a content-list item —
        // revealing its zone/slide is as far as we can target it.
        if ( typeof detail.index !== "number" ) {
          return;
        }

        api.selectPath?.( `${ base }.${ detail.index }` );
      };

      window.addEventListener(
        CONTENT_ITEM_SELECT_EVENT,
        handler
      );

      return () => window.removeEventListener(
        CONTENT_ITEM_SELECT_EVENT,
        handler
      );
    },
    []
  );
}

/**
 * Thin component wrapper around useContentSelectionListener, so SketchOptions
 * can drop it inside the providers without turning into a hook host itself.
 */
export function ContentSelectionListener( props: ListenerOptions ) {
  useContentSelectionListener( props );

  return null;
}
