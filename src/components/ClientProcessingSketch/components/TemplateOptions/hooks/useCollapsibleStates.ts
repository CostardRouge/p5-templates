import {
  useState, useCallback
} from "react";

export type CollapsibleSection =
  | "rootSettings"
  | "globalContent"
  | "slides"
  | "sketchSettings";

export type CollapsibleStates = Record<CollapsibleSection, boolean>;

const DEFAULT_STATES: CollapsibleStates = {
  rootSettings: false,
  globalContent: false,
  slides: false,
  sketchSettings: true
};

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