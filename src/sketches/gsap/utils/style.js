/**
 * Shared CSS helpers for GSAP/HTML photo templates.
 *
 * Turn the common `imageEffect` / `shadow` option groups into ready-to-use CSS
 * strings so every template applies them consistently.
 */

/** Build a CSS `filter` string from the common `imageEffect` option group. */
export function imageFilterCss( effect = {} ) {
  const {
    grayscale = 0,
    brightness = 1,
    contrast = 1,
    saturate = 1,
    blur = 0
  } = effect;

  const parts = [];

  if ( grayscale ) {
    parts.push( `grayscale(${ grayscale })` );
  }

  if ( brightness !== 1 ) {
    parts.push( `brightness(${ brightness })` );
  }

  if ( contrast !== 1 ) {
    parts.push( `contrast(${ contrast })` );
  }

  if ( saturate !== 1 ) {
    parts.push( `saturate(${ saturate })` );
  }

  if ( blur ) {
    parts.push( `blur(${ blur }px)` );
  }

  return parts.length ? parts.join( " " ) : "none";
}

/** Build a CSS `box-shadow` string from the common `shadow` option group. */
export function boxShadowCss( shadow = {} ) {
  const {
    enabled = true,
    blur = 40,
    opacity = 0.35,
    y = 24
  } = shadow;

  if ( !enabled ) {
    return "none";
  }

  return `0 ${ y }px ${ blur }px rgba(0, 0, 0, ${ opacity })`;
}
