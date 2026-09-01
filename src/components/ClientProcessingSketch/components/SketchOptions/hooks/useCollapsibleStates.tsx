import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";

import {
  isPanelSectionKey, readSketchPanelState, saveCollapsibleKeys
} from "@/hooks/usePanelState";

export type CollapsibleSection =
  | "rootSettings"
  | "content"
  | "transition"
  | "sketchSettings"
  | "sketchSection";

export type CollapsibleStates = Record<CollapsibleSection, boolean>;

type NestedCollapsibleKey = string;

type AllCollapsibleStates = Record<CollapsibleSection | NestedCollapsibleKey, boolean>;

// rootSettings = the inspector's "canvas & animation" section; content = the
// rail's layers band, which holds both scopes since the list replaced the two
// separate sections. Both open by default: the band shows the layer LIST, and
// the heavy item forms now sit behind ContentLayerDetail's own dynamic import,
// so opening a page no longer compiles them.
const DEFAULT_STATES: CollapsibleStates = {
  rootSettings: true,
  content: true,
  transition: true,
  // The panel itself (floating card / mobile drawer) and the sketch's own
  // "N options" band inside it.
  sketchSettings: true,
  sketchSection: true
};

type CollapsibleContextValue = {
  states: AllCollapsibleStates;
  getExpanded: ( key: string, defaultValue?: boolean ) => boolean;
  setExpanded: ( key: string, expanded: boolean ) => void;
  toggleExpanded: ( key: string ) => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>( null );

/**
 * Hydrate a collapsible store from the sketch's persisted record once, then
 * write every later change through.
 *
 * Hydration runs in an effect rather than in the `useState` initialiser
 * because this subtree is server-rendered: reading localStorage during the
 * first render would make the client's markup disagree with the server's. The
 * cost is one frame at the defaults — the same trade `usePanelDock`'s
 * `getServerSnapshot` makes.
 *
 * The write waits for `hydratedKey` to catch up rather than a ref, so it never
 * runs on the pass that is still holding the defaults. A ref would flip to
 * true in the hydrating effect and let the very next effect save the defaults
 * over the values it had just read.
 *
 * `storageKey` undefined means "do not persist": the embed panel mounts a
 * provider too, and a public embed has no business carrying a viewer's panel
 * state.
 */
function usePersistedCollapsibles(
  storageKey: string | undefined,
  states: Record<string, boolean>,
  setStates: Dispatch<SetStateAction<Record<string, boolean>>>,
  owns: ( key: string ) => boolean
) {
  const [
    hydratedKey,
    setHydratedKey
  ] = useState<string | null>( null );

  useEffect(
    () => {
      if ( !storageKey ) {
        return;
      }

      const stored = readSketchPanelState( storageKey );
      const restored = Object.fromEntries( Object.entries( stored?.keys ?? {} )
        .filter( ( [
          key
        ] ) => owns( key ) ) );

      if ( Object.keys( restored ).length > 0 ) {
        setStates( ( previous ) => ( {
          ...previous,
          ...restored
        } ) );
      }

      setHydratedKey( storageKey );
    },
    // `owns` is a module-level predicate; re-running on a new sketch is what
    // storageKey is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      storageKey,
      setStates
    ]
  );

  useEffect(
    () => {
      if ( !storageKey || hydratedKey !== storageKey ) {
        return;
      }

      saveCollapsibleKeys(
        storageKey,
        Object.fromEntries( Object.entries( states ).filter( ( [
          key
        ] ) => owns( key ) ) )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      storageKey,
      hydratedKey,
      states
    ]
  );
}

/** The provider owns every key that is not one of the named sections. */
const ownsDynamicKey = ( key: string ) => !isPanelSectionKey( key );

export function CollapsibleProvider( {
  children,
  initialStates,
  storageKey
}: {
  children: ReactNode;
  initialStates?: Partial<CollapsibleStates>;
  /** `<engineId>:<name>` to remember this sketch's groups; omit to stay
   *  ephemeral (see usePersistedCollapsibles). */
  storageKey?: string;
} ) {
  const [
    states,
    setStates
  ] = useState<AllCollapsibleStates>( {
    ...DEFAULT_STATES,
    ...initialStates
  } );

  usePersistedCollapsibles(
    storageKey,
    states,
    setStates,
    ownsDynamicKey
  );

  const getExpanded = useCallback(
    (
      key: string, defaultValue = false
    ) => {
      return states[ key ] ?? defaultValue;
    },
    [
      states
    ]
  );

  const setExpanded = useCallback(
    (
      key: string, expanded: boolean
    ) => {
      setStates( ( prev ) => ( {
        ...prev,
        [ key ]: expanded
      } ) );
    },
    []
  );

  const toggleExpanded = useCallback(
    ( key: string ) => {
      setStates( ( prev ) => ( {
        ...prev,
        [ key ]: !( prev[ key ] ?? false )
      } ) );
    },
    []
  );

  const value = useMemo(
    () => ( {
      states,
      getExpanded,
      setExpanded,
      toggleExpanded
    } ),
    [
      states,
      getExpanded,
      setExpanded,
      toggleExpanded
    ]
  );

  return (
    <CollapsibleContext.Provider value={ value }>
      {children}
    </CollapsibleContext.Provider>
  );
}

export function useCollapsibleContext() {
  const context = useContext( CollapsibleContext );

  if ( !context ) {
    throw new Error( "useCollapsibleContext must be used within CollapsibleProvider" );
  }

  return context;
}

/**
 * The panel's named sections.
 *
 * `initialStates` are DEFAULTS, not overrides: a stored value wins over them,
 * including the mobile drawer's `rootSettings: false`. Remembering a panel
 * matters most on the small screen, so that is the last place the default
 * should keep winning.
 */
export function useCollapsibleStates(
  initialStates?: Partial<CollapsibleStates>,
  storageKey?: string
) {
  const [
    states,
    setStates
  ] = useState<CollapsibleStates>( {
    ...DEFAULT_STATES,
    ...initialStates
  } );

  usePersistedCollapsibles(
    storageKey,
    states,
    setStates as Dispatch<SetStateAction<Record<string, boolean>>>,
    isPanelSectionKey
  );

  const toggleSection = useCallback(
    ( section: CollapsibleSection ) => {
      setStates( ( prev ) => ( {
        ...prev,
        [ section ]: !prev[ section ]
      } ) );
    },
    []
  );

  const setSection = useCallback(
    (
      section: CollapsibleSection, expanded: boolean
    ) => {
      setStates( ( prev ) => ( {
        ...prev,
        [ section ]: expanded
      } ) );
    },
    []
  );

  return {
    states,
    toggleSection,
    setSection
  };
}