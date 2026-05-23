"use client";

import {
  useEffect, useState
} from "react";

// Matches Tailwind's `md` breakpoint (≥768px = desktop, <768px = mobile).
const MOBILE_BREAKPOINT_PX = 768;

export default function useIsMobile(): boolean {
  const [
    isMobile,
    setIsMobile
  ] = useState( false );

  useEffect(
    () => {
      const mq = window.matchMedia( `(max-width: ${ MOBILE_BREAKPOINT_PX - 1 }px)` );

      const update = ( e?: MediaQueryListEvent ) => {
        setIsMobile( e ? e.matches : mq.matches );
      };

      update();
      mq.addEventListener(
        "change",
        update
      );

      return () => mq.removeEventListener(
        "change",
        update
      );
    },
    []
  );

  return isMobile;
}
