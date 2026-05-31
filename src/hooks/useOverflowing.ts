"use client";

import {
  useCallback, useEffect, useRef, useState
} from "react";

/**
 * Reports whether an element's content overflows it horizontally
 * (`scrollWidth > clientWidth`). Re-measures on element resize via a
 * ResizeObserver and whenever one of `deps` changes (e.g. item count or
 * layout mode), so callers get a single source of truth for "is there
 * anything to scroll to" — used to show a scroll affordance only when it
 * actually applies.
 *
 * A 1px tolerance avoids sub-pixel false positives.
 */
export function useOverflowing<T extends HTMLElement>( deps: unknown[] = [] ) {
  const ref = useRef<T | null>( null );
  const [
    overflowing,
    setOverflowing
  ] = useState( false );

  const measure = useCallback(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      setOverflowing( el.scrollWidth - el.clientWidth > 1 );
    },
    []
  );

  useEffect(
    () => {
      const el = ref.current;

      if ( !el || typeof ResizeObserver === "undefined" ) {
        return;
      }

      measure();

      const observer = new ResizeObserver( measure );

      observer.observe( el );
      return () => observer.disconnect();
    },
    // measure is stable; the spread lets callers force a re-measure.
    [
      measure,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ...deps
    ]
  );

  return {
    ref,
    overflowing
  };
}
