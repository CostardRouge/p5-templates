"use client";

import {
  useEffect, useState
} from "react";
import GalleryPage from "@/components/GalleryPage/GalleryPage";
import {
  GALLERY_COOKIE, readGalleryPrefs, type GalleryPrefs
} from "@/lib/gallery/view";
import {
  localDay
} from "@/lib/postiz/rhythm";

/** The cookie's raw value, read in the browser. */
function readCookie( name: string ): string | undefined {
  const prefix = `${ name }=`;

  return document.cookie
    .split( "; " )
    .find( ( part ) => part.startsWith( prefix ) )
    ?.slice( prefix.length );
}

/**
 * The gallery for the static front (app/gallery/page.static.tsx). The full
 * server reads the view cookie and paints the final view at once (lab 3: no
 * Month-then-swap reflow). A static page cannot, so this renders nothing until
 * the browser has read the cookie, then mounts the gallery in that view: one
 * empty frame instead of a wrong one. The gallery's content comes from
 * IndexedDB, in the browser, either way.
 */
export default function GalleryFromCookie() {
  const [
    prefs,
    setPrefs
  ] = useState<GalleryPrefs | null>( null );

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the cookie only exists in the browser
      setPrefs( readGalleryPrefs( readCookie( GALLERY_COOKIE ) ) );
    },
    []
  );

  if ( !prefs ) {
    return null;
  }

  return (
    <GalleryPage
      initialView={ prefs.view }
      initialTimeZone={ prefs.timeZone }
      initialToday={ localDay(
        new Date(),
        prefs.timeZone
      ) }
    />
  );
}
