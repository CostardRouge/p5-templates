import {
  useRef, useState, useCallback
} from "react";
import type {
  CSSProperties
} from "react";

interface MarqueeState {
  dx: number;
  duration: number;
}

interface UseMarqueeOnHoverOptions {
  /** Pixels per second for the scroll speed. */
  speed?: number;
  /** Minimum animation duration in seconds. */
  minDuration?: number;
  /** Maximum animation duration in seconds. */
  maxDuration?: number;
  /** Constant added to computed duration (entry/exit pause time). */
  paddingDuration?: number;
}

interface UseMarqueeOnHoverReturn<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isActive: boolean;
  style: CSSProperties | undefined;
}

/**
 * Lazy marquee-on-hover for an overflowing element.
 *
 * Measures `scrollWidth - clientWidth` only on `mouseenter` — no
 * ResizeObserver, no mount-time work. Re-measuring on each enter handles
 * window resize without any global listener.
 *
 * Pair the returned `style` with the `animate-marquee-hover` Tailwind animation,
 * which reads `--marquee-dx` / `--marquee-duration` CSS variables.
 */
export function useMarqueeOnHover<T extends HTMLElement = HTMLElement>( options: UseMarqueeOnHoverOptions = {} ): UseMarqueeOnHoverReturn<T> {
  const {
    speed = 40,
    minDuration = 3,
    maxDuration = 12,
    paddingDuration = 2
  } = options;

  const ref = useRef<T>( null );
  const [
    marquee,
    setMarquee
  ] = useState<MarqueeState | null>( null );

  const onMouseEnter = useCallback(
    () => {
      const el = ref.current;

      if ( !el ) {
        return;
      }

      const overflow = el.scrollWidth - el.clientWidth;

      if ( overflow <= 0 ) {
        return;
      }

      const duration = Math.min(
        maxDuration,
        Math.max(
          minDuration,
          overflow / speed + paddingDuration
        )
      );

      setMarquee( {
        dx: -overflow,
        duration
      } );
    },
    [
      speed,
      minDuration,
      maxDuration,
      paddingDuration
    ]
  );

  const onMouseLeave = useCallback(
    () => {
      setMarquee( null );
    },
    []
  );

  const style: CSSProperties | undefined = marquee
    ? ( {
      "--marquee-dx": `${ marquee.dx }px`,
      "--marquee-duration": `${ marquee.duration }s`
    } as CSSProperties )
    : undefined;

  return {
    ref,
    onMouseEnter,
    onMouseLeave,
    isActive: marquee !== null,
    style
  };
}
