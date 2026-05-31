"use client";

import {
  useCallback, useEffect, useRef, useState
} from "react";

/**
 * Tracks horizontal overflow of an element and how far it is scrolled.
 *
 * - `overflowing`: content is wider than the box (`scrollWidth > clientWidth`),
 *   i.e. there is something to scroll to. A single source of truth for showing
 *   a scroll affordance only when it applies.
 * - `atEnd`: scrolled all the way to the right (no more content to the right) —
 *   or not overflowing at all. Lets callers drop a right-edge fade once the end
 *   is reached so it never lingers over empty space.
 *
 * Re-measures on element resize (ResizeObserver), on scroll, and whenever one
 * of `deps` changes (e.g. item count or layout mode). A 1px tolerance avoids
 * sub-pixel false positives.
 */
export function useOverflowing<T extends HTMLElement>( deps: unknown[] = [] ) {
  const ref = useRef<T | null>( null );
  const [
    overflowing,
    setOverflowing
  ] = useState( false );
  const [
    atEnd,
    setAtEnd
  ] = useState( true );

  const measure = useCallback(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const maxScroll = el.scrollWidth - el.clientWidth;

      setOverflowing( maxScroll > 1 );
      setAtEnd( maxScroll <= 1 || el.scrollLeft >= maxScroll - 1 );
    },
    []
  );

  useEffect(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      measure();

      el.addEventListener(
        "scroll",
        measure,
        {
          passive: true
        }
      );

      const observer =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver( measure )
          : null;

      observer?.observe( el );

      return () => {
        el.removeEventListener(
          "scroll",
          measure
        );
        observer?.disconnect();
      };
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
    overflowing,
    atEnd
  };
}
