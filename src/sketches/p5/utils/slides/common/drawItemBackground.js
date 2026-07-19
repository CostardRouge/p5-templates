import {
  getP5
} from "../../sketch.js";

/**
 * Tight vertical glyph box of a single line of `text` drawn at (x, y) with the
 * TOP text baseline (how the overlays lay out their text). Returns
 * { top, bottom } in canvas pixels.
 *
 * Uses the loaded p5.Font's real glyph bounds (font.textBounds) when available
 * — the robust path, so the panel hugs the actual caps/descenders instead of
 * the nominal em box (which reads as "more space on top than bottom"). Falls
 * back to ascent/descent metrics when the font is still loading.
 */
export function measureVerticalTextBox(
  font, text, x, y, size
) {
  const p = getP5();

  p.push();
  p.textFont( font );
  p.textSize( size );
  p.textAlign(
    p.LEFT,
    p.TOP
  );

  let top = y;
  let bottom = y + size;

  // p5 v2: readiness lives on `font.data`, and textBounds reads size and
  // alignment from the renderer state set above (a 4th positional number
  // would be treated as a wrap width).
  if ( font && typeof font.textBounds === "function" && font.data && text ) {
    try {
      const box = font.textBounds(
        text,
        x,
        y,
        {
          graphics: p
        }
      );

      if ( box && Number.isFinite( box.y ) && Number.isFinite( box.h ) ) {
        top = box.y;
        bottom = box.y + box.h;
      }
    } catch {
      // Fall back to metrics below on any font-internal failure.
      const asc = p.textAscent();
      const desc = p.textDescent();

      top = y;
      bottom = y + asc + desc;
    }
  } else {
    const asc = p.textAscent();
    const desc = p.textDescent();

    top = y;
    bottom = y + asc + desc;
  }

  p.pop();

  return {
    top,
    bottom
  };
}

/**
 * Draw a rounded background panel behind a content-item's text block (slide
 * title, specs, HUD widgets). Shared so the three overlays paint an identical
 * chip: an rgba `color` fill and an optional rgba `stroke` outline (both
 * default transparent — draw nothing), a corner `radius` in pixels (clamped to
 * the panel's half-size), and an `alpha` multiplier (0..1) so overlays that
 * fade carry the panel with them.
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
  alpha = 1,
  stroke,
  strokeWeight = 0
} ) {
  if ( w <= 0 || h <= 0 ) {
    return;
  }

  const fillAlpha = Array.isArray( color ) ? ( color[ 3 ] ?? 255 ) * alpha : 0;
  const hasStroke = Array.isArray( stroke ) && strokeWeight > 0;
  const strokeAlpha = hasStroke ? ( stroke[ 3 ] ?? 255 ) * alpha : 0;

  // A fully transparent panel (the default) paints nothing — the common case.
  if ( fillAlpha <= 0 && strokeAlpha <= 0 ) {
    return;
  }

  const p = getP5();
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

  if ( fillAlpha > 0 ) {
    const fill = p.color(
      color[ 0 ] ?? 0,
      color[ 1 ] ?? 0,
      color[ 2 ] ?? 0
    );

    fill.setAlpha( fillAlpha );
    p.fill( fill );
  } else {
    p.noFill();
  }

  if ( strokeAlpha > 0 ) {
    const line = p.color(
      stroke[ 0 ] ?? 0,
      stroke[ 1 ] ?? 0,
      stroke[ 2 ] ?? 0
    );

    line.setAlpha( strokeAlpha );
    p.stroke( line );
    p.strokeWeight( strokeWeight );
  } else {
    p.noStroke();
  }

  p.rect(
    x,
    y,
    w,
    h,
    r
  );
  p.pop();
}
