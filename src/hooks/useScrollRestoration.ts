"use client";

import {
  useEffect
} from "react";
import {
  usePathname
} from "next/navigation";

const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(
    () => {
    // Restore scroll position when navigating back
      const savedPosition = scrollPositions.get( pathname );

      if ( savedPosition !== undefined ) {
      // Use setTimeout to ensure DOM is fully rendered
        setTimeout(
          () => {
            window.scrollTo(
              0,
              savedPosition
            );
          },
          0
        );
      }

      // Save scroll position before navigating away
      const saveScrollPosition = () => {
        scrollPositions.set(
          pathname,
          window.scrollY
        );
      };

      // Save on scroll
      const handleScroll = () => {
        scrollPositions.set(
          pathname,
          window.scrollY
        );
      };

      window.addEventListener(
        "scroll",
        handleScroll,
        {
          passive: true
        }
      );

      // Save before unload
      return () => {
        saveScrollPosition();
        window.removeEventListener(
          "scroll",
          handleScroll
        );
      };
    },
    [
      pathname
    ]
  );
}
