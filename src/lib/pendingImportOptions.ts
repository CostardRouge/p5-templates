// One-shot sessionStorage handoff for the sketches listing page's
// "Import .json" button: the listing page writes the parsed options right
// before a hard navigation into the matched sketch, since the listing
// page and the sketch page are separate mounted trees with no shared
// React state. The sketch page reads (and clears) it once on mount.
const STORAGE_KEY = "sketchbook:pending-import";
// Key used before the project was renamed from p5-templates. A pending import
// written by the previous build can still be sitting in sessionStorage when
// the new build loads mid-session — read (and clear) it as a fallback.
const LEGACY_STORAGE_KEY = "p5-templates:pending-import";

export function writePendingImport( options: unknown ): boolean {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify( options )
    );
    return true;
  } catch {
    return false;
  }
}

export function readAndClearPendingImport(): unknown | null {
  try {
    let raw = sessionStorage.getItem( STORAGE_KEY );

    if ( raw !== null ) {
      sessionStorage.removeItem( STORAGE_KEY );
    } else {
      raw = sessionStorage.getItem( LEGACY_STORAGE_KEY );

      if ( raw !== null ) {
        sessionStorage.removeItem( LEGACY_STORAGE_KEY );
      }
    }

    if ( !raw ) {
      return null;
    }

    return JSON.parse( raw );
  } catch {
    return null;
  }
}
