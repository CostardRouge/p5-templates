import {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";

// ─────────────────────────────────────────────────────────────────────────────
// The RASTER: a unit of text drawn into an offscreen graphic once, kept as one
// byte per pixel. This is `sculpt-v2-letter-relief`'s rasteriser, lifted so
// the typographic sculpts after it share one mask — what a mask MEANS (the
// area under a cell, the distance to the ink, the way a stroke runs) is read
// by `_ink.js`, which is pure; this file is the one that needs p5 and a font.
//
// A character is drawn white on black into a graphic sized to the sheet's
// aspect, and only the red channel is kept. The unit is centred on its INK's
// bounding box, not on the font's metrics — textAlign( CENTER, CENTER ) sits a
// capital a tenth of the sheet too low in agiro — so a glyph lands where the
// offset says, in any font. `weight` strokes the text (white to thicken,
// black over the fill to thin). Memoised by every input, so a beat costs one
// lookup; the distance field `_ink.js` derives is memoised on the mask too.
// ─────────────────────────────────────────────────────────────────────────────

export const MASK_WIDTH = 384; // mask raster width; the height follows the aspect

const maskMemo = new Map();
const MASK_MEMO_MAX = 32;

// Bounding box centre of the lit pixels of a graphic, or null when nothing is lit.
function inkCentre(
  pixels, w, h
) {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;

  for ( let y = 0; y < h; y++ ) {
    for ( let x = 0; x < w; x++ ) {
      if ( pixels[ ( y * w + x ) * 4 ] > 127 ) {
        minX = Math.min(
          minX,
          x
        );
        maxX = Math.max(
          maxX,
          x
        );
        minY = Math.min(
          minY,
          y
        );
        maxY = Math.max(
          maxY,
          y
        );
      }
    }
  }

  return maxX < 0 ? null : {
    x: ( minX + maxX ) / 2,
    y: ( minY + maxY ) / 2
  };
}

function rasteriseMask( {
  unit,
  font,
  size,
  weight,
  offset,
  aspect
} ) {
  const p = getP5();
  const mw = MASK_WIDTH;
  const mh = Math.max(
    8,
    Math.round( mw / aspect )
  );
  const g = p.createGraphics(
    mw,
    mh
  );

  g.pixelDensity( 1 );

  const draw = (
    x, y
  ) => {
    g.background( 0 );
    g.fill( 255 );

    if ( weight > 0 ) {
      g.stroke( 255 );
      g.strokeWeight( weight * mh * 0.01 );
    } else {
      g.noStroke();
    }

    g.text(
      unit,
      x,
      y
    );

    if ( weight < 0 ) {
      g.noFill();
      g.stroke( 0 );
      g.strokeWeight( -weight * mh * 0.01 );
      g.text(
        unit,
        x,
        y
      );
    }

    g.loadPixels();
  };

  if ( unit ) {
    g.textFont( font );

    let textSize = size * mh;

    g.textSize( textSize );

    // A word wider than the sheet is shrunk to fit.
    const width = g.textWidth( unit );

    if ( width > mw * 0.92 ) {
      textSize *= ( mw * 0.92 ) / width;
      g.textSize( textSize );
    }

    g.textAlign(
      p.CENTER,
      p.CENTER
    );

    const targetX = mw / 2 + ( offset?.x ?? 0 ) * mw;
    const targetY = mh / 2 + ( offset?.y ?? 0 ) * mh;

    // First pass to find where the ink lands, second pass to put its centre
    // on the target.
    draw(
      targetX,
      targetY
    );

    const centre = inkCentre(
      g.pixels,
      mw,
      mh
    );

    if ( centre ) {
      draw(
        targetX + ( targetX - centre.x ),
        targetY + ( targetY - centre.y )
      );
    }
  } else {
    g.background( 0 );
    g.loadPixels();
  }

  const data = new Uint8Array( mw * mh );

  for ( let i = 0; i < data.length; i++ ) {
    data[ i ] = g.pixels[ i * 4 ];
  }

  // p5.Graphics.remove() frees the GPU side and detaches the canvas, then
  // throws on `_pInst._elements` in this p5 build (text/text-dice hit the same
  // and keeps the same fallback). The canvas is already out of the DOM by
  // then; the fallback covers the path where it is not.
  try {
    g.remove();
  } catch {
    g.canvas?.remove?.();
  }

  return {
    data,
    w: mw,
    h: mh
  };
}

/**
 * The mask of one unit of text, memoised. Returns null while the font is
 * still loading (and does not cache the miss).
 *
 * @param {object} cfg
 * @param {string} cfg.unit       the text (a letter, a word, the whole text)
 * @param {string} cfg.fontName   a key of string.fonts
 * @param {number} cfg.size       glyph height as a fraction of the sheet's
 * @param {number} cfg.weight     ink weight, thickens (> 0) or thins (< 0)
 * @param {{x:number,y:number}} [cfg.offset] fractions of the sheet
 * @param {number} cfg.aspect     canvas width / height
 * @returns {{ key: string, data: Uint8Array, w: number, h: number }|null}
 */
export function getMask( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;

  if ( !font?.font ) {
    return null;
  }

  const fontFamily = font.font?.names?.fontFamily?.en || cfg.fontName;
  const key = [
    cfg.unit,
    fontFamily,
    cfg.size,
    cfg.weight,
    cfg.offset?.x ?? 0,
    cfg.offset?.y ?? 0,
    cfg.aspect.toFixed( 4 )
  ].join( "|" );
  const cached = maskMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const mask = {
    key,
    ...rasteriseMask( {
      ...cfg,
      font
    } )
  };

  maskMemo.set(
    key,
    mask
  );

  if ( maskMemo.size > MASK_MEMO_MAX ) {
    maskMemo.delete( maskMemo.keys().next().value );
  }

  return mask;
}

/**
 * The masks of every unit of a text, or null while the font loads. `clampSize`
 * keeps the glyph height inside what the raster can hold.
 */
export function getMasks(
  units, {
    fontName,
    size,
    weight,
    offset,
    aspect
  }
) {
  const masks = [];

  for ( const unit of units ) {
    const mask = getMask( {
      unit,
      fontName,
      size: Math.min(
        1.5,
        Math.max(
          0.05,
          size
        )
      ),
      weight,
      offset,
      aspect
    } );

    if ( !mask ) {
      return null;
    }

    masks.push( mask );
  }

  return masks;
}
