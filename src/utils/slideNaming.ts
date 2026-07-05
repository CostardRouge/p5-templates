/**
 * Slide auto-naming helpers.
 *
 * New slides are labelled with spreadsheet-style letters (A, B, …, Z, AA, AB, …).
 * Duplicating a slide appends the next free numeric suffix ("A" -> "A-1" -> "A-2").
 * Duplicating an already-numbered copy merges the letter and number into a fresh
 * base so the copies branch off ("A-12" -> "A12-1").
 */

/**
 * Bijective base-26 label for a zero-based index:
 * 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB", …
 */
export function indexToLetters( index: number ): string {
  let n = Math.max(
    0,
    Math.floor( index )
  );
  let result = "";

  do {
    result = String.fromCharCode( 65 + ( n % 26 ) ) + result;
    n = Math.floor( n / 26 ) - 1;
  } while ( n >= 0 );

  return result;
}

const NUMBERED_COPY = /^(.+)-(\d+)$/;

/**
 * Name for a duplicate of `sourceName`, picking the lowest free numeric suffix
 * that does not collide with `existingNames`.
 *
 * - "A"    -> "A-1" (then "A-2", "A-3", …)
 * - "A-12" -> "A12-1" (copying a copy branches off a merged base)
 */
export function makeCopyName(
  sourceName: string, existingNames: Iterable<string>
): string {
  const trimmed = sourceName.trim();
  const match = NUMBERED_COPY.exec( trimmed );
  const base = match ? `${ match[ 1 ] }${ match[ 2 ] }` : trimmed;
  const used = new Set( existingNames );

  let n = 1;

  while ( used.has( `${ base }-${ n }` ) ) {
    n += 1;
  }

  return `${ base }-${ n }`;
}
