import {
  useEffect, useRef
} from "react";

/**
 * Imperatively tween an element's `style.width` (as a percentage) toward
 * a target that may itself change every render. The rAF loop reads the
 * latest target from a ref, so streamed updates collapsed by React 18's
 * batching still produce a visibly smooth fill — useful for progress
 * bars whose source events fire faster than React renders (eg. an
 * async-loop recorder pushing per-frame events on a short sketch).
 *
 * `factor` is the fraction of the remaining gap closed per animation
 * frame. The default (~0.15) converges in ≈200 ms at 60 fps, matching
 * the feel of a `transition: width 200ms ease-out` without the
 * batching pitfalls.
 */
export function useSmoothFill<T extends HTMLElement = HTMLElement>(
  enabled: boolean,
  targetPercentage: number,
  factor = 0.15
) {
  const elementRef = useRef<T | null>( null );
  const targetRef = useRef( targetPercentage );

  targetRef.current = targetPercentage;

  useEffect(
    () => {
      if ( !enabled ) {
        return;
      }

      let rafId = 0;
      let current = 0;

      const tick = () => {
        const target = targetRef.current;
        const diff = target - current;

        current = Math.abs( diff ) < 0.1 ? target : current + diff * factor;

        if ( elementRef.current ) {
          elementRef.current.style.width = `${ current }%`;
        }

        rafId = requestAnimationFrame( tick );
      };

      rafId = requestAnimationFrame( tick );

      return () => cancelAnimationFrame( rafId );
    },
    [
      enabled,
      factor
    ]
  );

  return elementRef;
}
