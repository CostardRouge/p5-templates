"use client";

import {
  useEffect, useRef, type RefObject
} from "react";

/**
 * Returns a ref to attach to a draggable control (value slider, alpha bar, 2D
 * pad…). While a touch is in progress on the element it cancels the browser's
 * default touch behaviour (panning) through a non-passive `touchmove` listener,
 * so dragging the control can't scroll the surrounding panel up or down.
 *
 * `touch-action: none` already covers this on most browsers, but iOS Safari
 * intermittently ignores it for descendants of a momentum-scrolling container
 * (the mobile studio drawer). The explicit guard makes the behaviour reliable.
 * Mouse and pen input are untouched — `touchmove` only fires for touch.
 */
export default function usePreventTouchScroll<
  T extends HTMLElement
>(): RefObject<T | null> {
  const ref = useRef<T>( null );

  useEffect(
    () => {
      const element = ref.current;

      if ( !element ) {
        return;
      }

      const preventScroll = ( event: TouchEvent ) => event.preventDefault();

      element.addEventListener(
        "touchmove",
        preventScroll,
        {
          passive: false
        }
      );

      return () => element.removeEventListener(
        "touchmove",
        preventScroll
      );
    },
    []
  );

  return ref;
}
