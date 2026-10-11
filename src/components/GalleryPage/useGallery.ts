"use client";

import {
  useEffect, useState
} from "react";

import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";

type GalleryRead = {
  entries: GalleryEntry[] | null;
  error: string | null;
};

/**
 * The whole gallery, newest first, re-read after every write to the store in
 * this tab and whenever the tab comes back into view — another tab's keep is
 * not broadcast, so returning to the page is what refreshes it.
 */
export function useGallery(): GalleryRead {
  const [
    read,
    setRead
  ] = useState<GalleryRead>( {
    entries: null,
    error: null
  } );

  useEffect(
    () => {
      let live = true;
      const reload = () => {
        getGalleryStore().entries()
          .then(
            ( entries ) => {
              if ( live ) {
                setRead( {
                  entries,
                  error: null
                } );
              }
            },
            ( caught: unknown ) => {
              if ( live ) {
                setRead( {
                  entries: [],
                  error: caught instanceof Error ? caught.message : String( caught )
                } );
              }
            }
          );
      };
      const onVisible = () => {
        if ( document.visibilityState === "visible" ) {
          reload();
        }
      };
      const off = getGalleryStore().subscribe( reload );

      document.addEventListener(
        "visibilitychange",
        onVisible
      );
      reload();

      return () => {
        live = false;
        off();
        document.removeEventListener(
          "visibilitychange",
          onVisible
        );
      };
    },
    []
  );

  return read;
}
