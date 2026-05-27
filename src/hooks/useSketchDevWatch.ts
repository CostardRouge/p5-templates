"use client";

import {
  useEffect
} from "react";

export default function useSketchDevWatch(
  name: string, engineId: string, capturing = false
) {
  useEffect(
    () => {
      if ( process.env.NODE_ENV !== "development" || capturing ) {
        return;
      }

      const source = new EventSource( `/api/dev/sketch-watch?sketch=${ encodeURIComponent( name ) }&engine=${ encodeURIComponent( engineId ) }` );

      source.onmessage = ( event ) => {
      };

      source.onerror = () => {
        // Let EventSource auto-reconnect during transient dev-server restarts.
      };

      return () => {
        source.close();
      };
    },
    [
      name,
      engineId,
      capturing
    ]
  );
}
