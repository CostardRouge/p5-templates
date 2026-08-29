import {
  createContext, useContext, useState, useCallback, useMemo, type ReactNode
} from "react";

export type CollapsibleSection =
  | "rootSettings"
  | "globalContent"
  | "slides"
  | "sketchSettings"
  | "sketchSection";

export type CollapsibleStates = Record<CollapsibleSection, boolean>;

type NestedCollapsibleKey = string;

type AllCollapsibleStates = Record<CollapsibleSection | NestedCollapsibleKey, boolean>;

// rootSettings = the inspector's "canvas & animation" section; slides = the
// content rail's "slide N content" section — both open by default since the
// layout rework gave each its own home. globalContent (shared content) stays
// collapsed so the heavy content editor is not compiled on every page open.
const DEFAULT_STATES: CollapsibleStates = {
  rootSettings: true,
  globalContent: false,
  slides: true,
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

export function CollapsibleProvider( {
  children,
  initialStates
}: {
  children: ReactNode;
  initialStates?: Partial<CollapsibleStates>;
} ) {
  const [
    states,
    setStates
  ] = useState<AllCollapsibleStates>( {
    ...DEFAULT_STATES,
    ...initialStates
  } );

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

export function useCollapsibleStates( initialStates?: Partial<CollapsibleStates> ) {
  const [
    states,
    setStates
  ] = useState<CollapsibleStates>( {
    ...DEFAULT_STATES,
    ...initialStates
  } );

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