import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

// ── Where a text-shaped content item's glyphs VISIBLY are ──────────────────
// `string.write` lays text out inside a rect-mode box — (x, y) plus the layout
// width/height derived from the item's margins — and aligns the glyphs INSIDE
// that box. The drawn pixels therefore sit far from the (x, y) anchor the drag
// layer stores: a fresh text item at position.x = 0 draws mid-canvas while its
// anchor hugs the left edge. Reporting the layout box instead of the glyphs
// would hand the drag layer a near-full-canvas grab surface that swallows every
// press meant for another item (or for the viewport pan).
//
// Both text-shaped items — the "text" item and the "title" item, which share
// the same margin/alignment layout — resolve their grab rectangle here.

/**
 * Report the approximate glyph rectangle of a rect-mode text render.
 *
 * @param {object}   params
 * @param {string}   params.text             The string actually drawn.
 * @param {object}   [params.box]            `string.write()`'s return (the
 *                                           font's measured bounds), if any.
 * @param {number}   params.x                Layout-box origin (canvas px).
 * @param {number}   params.y
 * @param {number}   params.layoutWidth      Layout-box size (canvas px).
 * @param {number}   params.layoutHeight
 * @param {number}   params.size             Text size (canvas px).
 * @param {string}   [params.horizontalAlign]
 * @param {string}   [params.verticalAlign]
 * @param {Function} [params.measureLine]    Measures one line's width; used for
 *                                           multi-line text, whose lines the
 *                                           font measures as a single run.
 */
export default function reportTextItemBounds( {
  text,
  box,
  x,
  y,
  layoutWidth,
  layoutHeight,
  size,
  horizontalAlign = "center",
  verticalAlign = "baseline",
  measureLine
} ) {
  // Nothing drawn (empty string / missing font) → no grab zone to report.
  if ( !text ) {
    return;
  }

  const lines = String( text ).split( "\n" );

  // Width/height from the font's measured bounds (clamped to the layout box —
  // word-wrap never draws wider than it). A multi-line string measures as ONE
  // run: too wide and a single line tall, so measure the longest line instead
  // whenever the caller can, and stack the lines vertically.
  const measured = lines.length > 1 && measureLine
    ? Math.max( ...lines.map( ( line ) => measureLine( line ) ) )
    : box?.w ?? layoutWidth;

  const glyphW = Math.min(
    Math.max(
      measured,
      size
    ),
    layoutWidth
  );
  const glyphH = Math.min(
    Math.max(
      box?.h ?? size,
      size * lines.length
    ),
    layoutHeight
  );

  const left = horizontalAlign === "left"
    ? x
    : horizontalAlign === "right"
      ? x + layoutWidth - glyphW
      : x + ( layoutWidth - glyphW ) / 2;

  // Vertical: rect-mode CENTER/BOTTOM/TOP place the glyphs inside the box;
  // BASELINE is not honoured in rect mode and behaves like TOP, but older p5
  // builds treated it as glyphs-above-y — cover both with a band that spans one
  // glyph height on each side of y.
  let top;
  let boundsH = glyphH;

  switch ( verticalAlign ) {
    case "center":
      top = y + ( layoutHeight - glyphH ) / 2;
      break;
    case "bottom":
      top = y + layoutHeight - glyphH;
      break;
    case "top":
      top = y;
      break;
    default: // "baseline"
      top = y - glyphH;
      boundsH = glyphH * 2;
      break;
  }

  reportItemBounds(
    left,
    top,
    glyphW,
    boundsH
  );
}
