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

import {
  useCollapsibleContext
} from "./useCollapsibleStates";
import type {
  CollapsibleSection
} from "./useCollapsibleStates";
import {
  CONTENT_ITEM_SELECT_EVENT
} from "../constants/drawer-events";

/**
 * Bridges an on-canvas content-item press (dispatched by contentDrag.js as the
 * `CONTENT_ITEM_SELECT_EVENT` window event) to the options panel: it opens the
 * item's zone (global content, or the right slide), opens the item's form
 * section, and publishes the item's path so the rendered ItemFormWrapper can
 * scroll to and pulse itself.
 *
 * Two moving parts:
 *  - the CONTEXT holds the currently-selected item path + a monotonically
 *    increasing nonce (so re-selecting the same item re-triggers the effect).
 *    Items read it via useContentSelection().
 *  - the LISTENER hook wires the window event to the collapsible + slide
 *    machinery. It lives in a component rendered inside both CollapsibleProvider
 *    and ContentSelectionProvider (see TemplateOptions).
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
      section: "globalContent"
    };
  }

  const match = /^slide:(\d+)$/.exec( scope );

  if ( !match ) {
    return null;
  }

  const slideIndex = Number( match[ 1 ] );

  return {
    base: `slides.${ slideIndex }.content`,
    section: "slides",
    slideIndex
  };
}

type Selection = {
  path: string;
  nonce: number;
};

type ContentSelectionValue = {
  selection: Selection | null;
  selectPath: ( path: string ) => void;
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
    ( path: string ) => {
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
  const {
    setExpanded
  } = useCollapsibleContext();
  const context = useContext( ContentSelectionContext );
  const selectPath = context?.selectPath;

  // Keep the latest callbacks in a ref so the window listener is registered
  // once and never misses an update (the handler reads current values).
  const latest = useRef( {
    setSection,
    onSelectSlide,
    activeSlideIndex,
    setExpanded,
    selectPath
  } );

  latest.current = {
    setSection,
    onSelectSlide,
    activeSlideIndex,
    setExpanded,
    selectPath
  };

  useEffect(
    () => {
      const handler = ( event: Event ) => {
        const detail = ( event as CustomEvent ).detail as {
          scope?: string;
          index?: number | string;
          part?: string | null;
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

        const itemPath = `${ base }.${ detail.index }`;

        api.setExpanded(
          `item-${ itemPath }`,
          true
        );

        // A HUD sub-widget lives in a nested-object section of the item form;
        // open it too so its fields are visible once the item is revealed.
        if ( detail.part ) {
          api.setExpanded(
            `nested-${ itemPath }.${ detail.part }`,
            true
          );
        }

        api.selectPath?.( itemPath );
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
 * Thin component wrapper around useContentSelectionListener, so TemplateOptions
 * can drop it inside the providers without turning into a hook host itself.
 */
export function ContentSelectionListener( props: ListenerOptions ) {
  useContentSelectionListener( props );

  return null;
}
