"use client";

/**
 * EXIF helpers for the GSAP / HTML photo templates.
 *
 * Photos carry their capture settings (ISO, shutter speed, aperture, camera,
 * lens, …) in EXIF metadata. The p5 engine already ships a battle-tested
 * reader plus a set of "friendly" formatters — including the friendly
 * camera/lens name maps — so we reuse it here instead of maintaining a second
 * copy. This module only adds the small async glue the DOM engine needs:
 *
 *   • fetch a photo URL and hand its raw bytes to the shared reader, and
 *   • expose the normalised result to a React template through a hook.
 *
 * Reusing `@/p5/utils/exif` keeps the friendly-name maps a single source of
 * truth across both engines.
 */
import {
  useEffect, useState
} from "react";

import exif, {
  friendlyCameraModelNames,
  friendlyLensModelNames
} from "@/p5/utils/exif.js";

export {
  exif,
  friendlyCameraModelNames,
  friendlyLensModelNames
};

/**
 * Read + normalise the EXIF tags of an image URL. Always fetches the raw bytes
 * first — this works uniformly for bundled assets, the S3 proxy and `blob:`
 * uploads — and hands them to the shared reader. Resolves to `null` on any
 * failure so a template can fall back to placeholders / manual overrides.
 */
export async function loadExifFromUrl( url ) {
  if ( !url || typeof fetch !== "function" ) {
    return null;
  }

  try {
    const response = await fetch( url );

    if ( !response.ok ) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    return await exif.load( buffer );
  } catch {
    return null;
  }
}

/**
 * React hook: load the EXIF of `url` whenever it changes and return the
 * normalised tags (or `null` until they resolve / when absent).
 *
 * Only a *successful* read updates state, so a missing file or a failed read
 * leaves the template on its previous value rather than flashing empty — and
 * the cancelled flag guarantees no state update fires after unmount.
 */
export function useExif( url ) {
  const [
    data,
    setData
  ] = useState( null );

  useEffect(
    () => {
      let cancelled = false;

      loadExifFromUrl( url ).then( ( tags ) => {
        if ( !cancelled && tags ) {
          setData( tags );
        }
      } );

      return () => {
        cancelled = true;
      };
    },
    [ url ]
  );

  return data;
}

/**
 * React hook: load the EXIF of every URL in `urls` and return a `url → tags`
 * map, filling in as each read resolves. Used by templates that cycle through
 * several photos and need each one's own capture settings.
 *
 * Keyed off the joined URL list so it only re-loads when the set of images
 * actually changes — not on every render (a fresh `urls` array each time).
 */
export function useExifList( urls ) {
  const key = ( Array.isArray( urls ) ? urls : [] ).join( "|" );

  const [
    map,
    setMap
  ] = useState( {} );

  useEffect(
    () => {
      let cancelled = false;
      const list = Array.isArray( urls ) ? urls : [];

      list.forEach( ( url ) => {
        if ( !url ) {
          return;
        }

        loadExifFromUrl( url ).then( ( tags ) => {
          if ( cancelled || !tags ) {
            return;
          }

          setMap( ( prev ) => {
            if ( prev[ url ] ) {
              return prev;
            }

            return {
              ...prev,
              [ url ]: tags
            };
          } );
        } );
      } );

      return () => {
        cancelled = true;
      };
    },
    // Re-run only when the *set* of URLs changes (the joined key is stable
    // across renders, unlike the freshly-built `urls` array).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ key ]
  );

  return map;
}
