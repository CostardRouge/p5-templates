import {
  getP5
} from "../../sketch.js";

/**
 * Draw a rounded background panel behind a content-item's text block (slide
 * title, specs, HUD widgets). Shared so the three overlays paint an identical
 * chip: an rgba `color` (a fully transparent one — the default — draws
 * nothing), a corner `radius` in pixels (clamped to the panel's half-size), and
 * an `alpha` multiplier (0..1) so overlays that fade carry the panel with them.
 *
 * Drawn under a normal BLEND mode so a semi-transparent black actually darkens
 * the pixels underneath, independent of the item's own blend mode.
 */
export default function drawItemBackground( {
  x,
  y,
  w,
  h,
  color,
  radius = 0,
  alpha = 1
} ) {
  if ( !Array.isArray( color ) || w <= 0 || h <= 0 ) {
    return;
  }

  const baseAlpha = color[ 3 ] ?? 255;
  const finalAlpha = baseAlpha * alpha;

  // A transparent panel (default) paints nothing — the common case.
  if ( finalAlpha <= 0 ) {
    return;
  }

  const p = getP5();
  const fill = p.color(
    color[ 0 ] ?? 0,
    color[ 1 ] ?? 0,
    color[ 2 ] ?? 0
  );

  fill.setAlpha( finalAlpha );

  const r = Math.max(
    0,
    Math.min(
      radius,
      w / 2,
      h / 2
    )
  );

  p.push();
  p.blendMode( p.BLEND );
  p.rectMode( p.CORNER );
  p.noStroke();
  p.fill( fill );
  p.rect(
    x,
    y,
    w,
    h,
    r
  );
  p.pop();
}
