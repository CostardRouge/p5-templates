"use client";

import { useEffect } from "react";

export default function useSketchDevWatch( name: string ) {
  useEffect(
    () => {
      if ( process.env.NODE_ENV !== "development" ) {
        return;
      }

      const source = new EventSource( `/api/dev/sketch-watch?sketch=${ encodeURIComponent( name ) }` );

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
      name
    ]
  );
}
