import { useState, useEffect } from "react";

export function usePersistedSort<T>( key: string, defaultValue: T ): [
  T,
  ( value: T ) => void
] {
  const [
    value,
    setValue
  ] = useState<T>( () => {
    if ( typeof window === "undefined" ) return defaultValue;

    try {
      const stored = localStorage.getItem( key );
      return stored ? JSON.parse( stored ) : defaultValue;
    } catch {
      return defaultValue;
    }
  } );

  useEffect(
    () => {
      try {
        localStorage.setItem( key, JSON.stringify( value ) );
      } catch ( err ) {
        console.warn( `Failed to persist ${key}:`, err );
      }
    },
    [
      key,
      value
    ]
  );

  return [
    value,
    setValue
  ];
}
