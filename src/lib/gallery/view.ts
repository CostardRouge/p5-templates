/**
 * Which view the gallery opens on (lab 3: Month · Week · Grid, Month by
 * default, else the last one chosen) and the time zone its calendars use —
 * kept in a COOKIE rather than `localStorage` so the SERVER renders the page
 * in its final view: a client read would paint the default first and swap,
 * which is the reflow the maintainer ruled out (`docs/memory/gallery.md`).
 *
 * Pure and DOM-free; `writeGalleryCookie` is the one line that touches
 * `document`.
 */

export type GalleryView = "month" | "week" | "grid";

export const GALLERY_VIEWS: readonly GalleryView[] = [
  "month",
  "week",
  "grid"
];

export const DEFAULT_GALLERY_VIEW: GalleryView = "month";

/** Europe/Paris until a browser said its own zone (his rhythm's, Postiz's default here). */
export const DEFAULT_GALLERY_ZONE = "Europe/Paris";

export const GALLERY_COOKIE = "sketchbook-gallery";

export interface GalleryPrefs {
  view: GalleryView;
  /** An IANA zone the browser reported, or the default. */
  timeZone: string;
}

function validZone( tz: string ): boolean {
  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: tz
      }
    );

    return true;
  } catch {
    return false;
  }
}

/** The cookie's value read back, whatever an older or a hand-edited copy holds: `month~Europe/Paris`. */
export function readGalleryPrefs( raw: string | null | undefined ): GalleryPrefs {
  let text = raw ?? "";

  try {
    text = decodeURIComponent( text );
  } catch {
    // Not encoded: read as is.
  }

  const [
    view,
    zone
  ] = text.split( "~" );
  const tz = ( zone ?? "" ).slice(
    0,
    64
  );

  return {
    view: GALLERY_VIEWS.includes( view as GalleryView ) ? view as GalleryView : DEFAULT_GALLERY_VIEW,
    timeZone: tz && /^[A-Za-z0-9_+\-/]+$/.test( tz ) && validZone( tz ) ? tz : DEFAULT_GALLERY_ZONE
  };
}

/** The cookie's value for these prefs. */
export function galleryPrefsValue( prefs: GalleryPrefs ): string {
  return encodeURIComponent( `${ prefs.view }~${ prefs.timeZone }` );
}

/** Remember the prefs for the next visit — a year, this site only, never sent anywhere but here. */
export function writeGalleryCookie( prefs: GalleryPrefs ): void {
  try {
    document.cookie = `${ GALLERY_COOKIE }=${ galleryPrefsValue( prefs ) }; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Cookies off: the gallery opens on Month next time.
  }
}
