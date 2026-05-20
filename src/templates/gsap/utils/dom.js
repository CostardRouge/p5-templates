/**
 * Small DOM/markup helpers shared by GSAP/HTML templates.
 *
 * Kept framework-agnostic: they return plain data (arrays/strings) so a
 * template can map them into JSX however it likes, and the GSAP timeline can
 * target the resulting nodes via class selectors scoped to the stage.
 */

/** Split a string into words, preserving none-empty tokens. */
export function toWords( text ) {
  return String( text ?? "" )
    .trim()
    .split( /\s+/ )
    .filter( Boolean );
}

/** Split a string into individual characters (spaces become  ). */
export function toChars( text ) {
  return Array.from( String( text ?? "" ) ).map( ( char ) =>
    ( char === " " ? " " : char ) );
}

/**
 * Convert an `[r, g, b]` / `[r, g, b, a]` tuple (a, 0–255) or a string into a
 * CSS color. Passes strings through untouched so templates can accept either.
 */
export function toCssColor(
  value, fallback = "#000000"
) {
  if ( value == null ) {
    return fallback;
  }

  if ( typeof value === "string" ) {
    return value;
  }

  if ( Array.isArray( value ) ) {
    const [
      r = 0,
      g = 0,
      b = 0,
      a = 255
    ] = value;

    return `rgba(${ r }, ${ g }, ${ b }, ${ a / 255 })`;
  }

  return fallback;
}

/** Clamp a number into [min, max]. */
export function clamp(
  value, min, max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}
