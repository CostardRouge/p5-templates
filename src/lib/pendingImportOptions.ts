// One-shot sessionStorage handoff for the templates listing page's
// "Import .json" button: the listing page writes the parsed options right
// before a hard navigation into the matched template, since the listing
// page and the template page are separate mounted trees with no shared
// React state. The template page reads (and clears) it once on mount.
const STORAGE_KEY = "p5-templates:pending-import";

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
    const raw = sessionStorage.getItem( STORAGE_KEY );

    if ( raw !== null ) {
      sessionStorage.removeItem( STORAGE_KEY );
    }

    if ( !raw ) {
      return null;
    }

    return JSON.parse( raw );
  } catch {
    return null;
  }
}
