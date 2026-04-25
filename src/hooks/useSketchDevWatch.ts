"use client";

import { useEffect } from "react";

export default function useSketchDevWatch( name: string, engineId: string, capturing = false ) {
  useEffect(
    () => {
      if ( process.env.NODE_ENV !== "development" || capturing ) {
        return;
      }

      const source = new EventSource( `/api/dev/sketch-watch?sketch=${ encodeURIComponent( name ) }&engine=${ encodeURIComponent( engineId ) }` );

      source.onmessage = () => {
        window.location.reload();
      };

      source.onerror = () => {
        source.close();
      };

      return () => {
        source.close();
      };
    },
    [
      name,
      engineId
    ]
  );
}
