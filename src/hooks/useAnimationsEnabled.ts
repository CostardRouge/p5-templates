import {
  useCallback, useEffect, useState
} from "react";

const STORAGE_KEY = "templates-animations-enabled";

function readStored(): boolean | null {
  try {
    const raw = localStorage.getItem( STORAGE_KEY );

    if ( raw === null ) {
      return null;
    }

    const parsed = JSON.parse( raw );

    return typeof parsed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Tracks whether animated previews should play.
 *
 * Defaults to the user's `prefers-reduced-motion` setting (motion allowed
 * unless the OS asks for reduced motion). The choice is persisted in
 * localStorage and, once set, takes precedence over the OS preference.
 */
export function useAnimationsEnabled(): [boolean, ( value: boolean ) => void, boolean] {
  // Start disabled on the server so SSR/CSR match; we resolve the real value after mount.
  const [
    enabled,
    setEnabled
  ] = useState<boolean>( false );
  const [
    hydrated,
    setHydrated
  ] = useState( false );

  useEffect(
    () => {
      const stored = readStored();

      if ( stored !== null ) {
        setEnabled( stored );
      } else {
        const prefersReduced = window.matchMedia( "(prefers-reduced-motion: reduce)" ).matches;

        setEnabled( !prefersReduced );
      }

      setHydrated( true );
    },
    []
  );

  const update = useCallback(
    ( value: boolean ) => {
      setEnabled( value );

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( value )
        );
      } catch {
        // Ignore storage errors (quota, private mode, etc.)
      }
    },
    []
  );

  return [
    enabled,
    update,
    hydrated
  ];
}
