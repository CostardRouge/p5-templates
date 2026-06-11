"use client";

import {
  useCallback, useSyncExternalStore
} from "react";

/**
 * Tracks a CSS media query. Server snapshot is `false`; callers should only
 * rely on the value in client-rendered trees (the studio panels never SSR).
 */
export default function useMediaQuery( query: string ): boolean {
  const subscribe = useCallback(
    ( onChange: () => void ) => {
      const mediaQuery = window.matchMedia( query );

      mediaQuery.addEventListener(
        "change",
        onChange
      );

      return () => mediaQuery.removeEventListener(
        "change",
        onChange
      );
    },
    [
      query
    ]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia( query ).matches,
    () => false
  );
}
