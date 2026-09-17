import {
  getP5
} from "@/p5/utils/sketch.js";
import string from "@/p5/utils/string.js";
import {
  splitContours,
  resampleContour
} from "@/p5/utils/letterPaths.js";

// ─────────────────────────────────────────────────────────────────────────────
// The glyph geometry the flip category runs on, shared by every sketch in it.
//
// A "letter field" turns a letter or a word into a flat chain of round capsules
// in normalised glyph space: each glyph is sampled on its natural advance,
// recentred on its own bounding box, and written into a FIXED per-letter slice
// of one array — because GLSL ES 1.00 forbids indexing a uniform array by a
// uniform-derived index, so a shader can only reach a letter's capsules through
// loop variables over [L * SEG_STRIDE, L * SEG_STRIDE + count).
//
// It is pure geometry and knows nothing about how it is drawn: v1 raymarches it
// as one orbiting plane, v2 bakes one entry at a time into a flat card. Keeping
// it here is what stops the two from drifting apart — the memoisation included,
// since the cache is keyed on the parameters and not on the consumer.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_LETTERS = 8; // letters per entry (longer entries truncate)
export const SEG_STRIDE = 48; // capsules per letter (see the note above)
export const MAX_TOTAL_SEG = MAX_LETTERS * SEG_STRIDE; // flat capsule array size
export const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

// ── Letter geometry (built once per entry/font/detail, memoised) ─────────────
const geometryMemo = new Map();
const GEOMETRY_MEMO_MAX = 32;

// Build the capsule field for one centred entry: glyphs sampled one by one on
// their natural advances, each recentred on its own bounding box (small bounds
// for culling), the entry as a whole recentred on origin. Per-letter offsets
// are returned in normalised units ([x, y], y up), and each letter's capsules
// live in its own SEG_STRIDE slice so a slot can be packed straight into the
// shader's array without re-slicing.
export function buildLetterField( {
  text,
  fontName,
  sampleFactor,
  simplifyThreshold,
  contourBreak,
  spacing
} ) {
  const p = getP5();
  const font = string.fonts[ fontName ] ?? string.fonts.sans;

  if ( !font?.font || !text.length ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  const breakDistance = contourBreak * BUILD_SIZE;
  const sampleStep = Math.max(
    1,
    spacing * BUILD_SIZE
  );
  const seg = new Float32Array( MAX_TOTAL_SEG * 4 );
  const segCount = new Int32Array( MAX_LETTERS );
  const radius = new Float32Array( MAX_LETTERS );
  const centreX = new Float32Array( MAX_LETTERS ); // word space (build units)
  const centreY = new Float32Array( MAX_LETTERS );

  let letterIndex = 0;
  let pen = 0; // baseline x advance in build units
  let truncated = false;

  for ( const char of text ) {
    if ( letterIndex >= MAX_LETTERS ) {
      truncated = true;
      break;
    }

    const advance = p.textWidth( char );

    if ( char.trim() === "" ) {
      pen += advance;
      continue;
    }

    const raw = font.textToPoints(
      char,
      pen,
      0,
      BUILD_SIZE,
      {
        sampleFactor,
        simplifyThreshold
      }
    );

    pen += advance;

    if ( !raw.length ) {
      continue;
    }

    const contours = splitContours(
      raw,
      breakDistance
    )
      .map( ( pts ) => resampleContour(
        pts,
        sampleStep,
        true
      ) )
      .filter( ( pts ) => pts.length >= 2 );

    if ( !contours.length ) {
      continue;
    }

    // Bounding box of the glyph (word space) — its centre anchors the letter.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for ( const contour of contours ) {
      for ( const pt of contour ) {
        minX = Math.min(
          minX,
          pt.x
        );
        maxX = Math.max(
          maxX,
          pt.x
        );
        minY = Math.min(
          minY,
          pt.y
        );
        maxY = Math.max(
          maxY,
          pt.y
        );
      }
    }

    const ctrX = ( minX + maxX ) / 2;
    const ctrY = ( minY + maxY ) / 2;

    // Emit normalised capsules into this letter's fixed stride slice (recentred
    // on the glyph bbox, y flipped to point up, divided by BUILD_SIZE so a
    // glyph unit ≈ cap height). The base offset is letterIndex * SEG_STRIDE.
    const base = letterIndex * SEG_STRIDE;
    let local = 0;
    let maxR = 0;

    for ( const contour of contours ) {
      const m = contour.length;

      for ( let i = 0; i < m; i++ ) {
        if ( local >= SEG_STRIDE ) {
          truncated = true;
          break;
        }

        const a = contour[ i ];
        const b = contour[ ( i + 1 ) % m ];
        const ax = ( a.x - ctrX ) / BUILD_SIZE;
        const ay = -( a.y - ctrY ) / BUILD_SIZE;
        const bx = ( b.x - ctrX ) / BUILD_SIZE;
        const by = -( b.y - ctrY ) / BUILD_SIZE;
        const w = ( base + local ) * 4;

        seg[ w ] = ax;
        seg[ w + 1 ] = ay;
        seg[ w + 2 ] = bx;
        seg[ w + 3 ] = by;
        local++;

        maxR = Math.max(
          maxR,
          Math.hypot(
            ax,
            ay
          ),
          Math.hypot(
            bx,
            by
          )
        );
      }
    }

    if ( local === 0 ) {
      continue;
    }

    segCount[ letterIndex ] = local;
    radius[ letterIndex ] = maxR;
    centreX[ letterIndex ] = ctrX;
    centreY[ letterIndex ] = ctrY;
    letterIndex++;
  }

  p.pop();

  if ( letterIndex === 0 ) {
    return null;
  }

  if ( truncated ) {
    console.warn( `flip: "${ text }" truncated to ${ letterIndex } letters (max ${ MAX_LETTERS }, ${ SEG_STRIDE } capsules/letter). Use a shorter entry or raise the capsule spacing.` );
  }

  // Recentre the ENTRY: per-letter offsets relative to its bbox centre,
  // normalised, y flipped to world-up.
  let wordMinX = Infinity;
  let wordMaxX = -Infinity;
  let wordMinY = Infinity;
  let wordMaxY = -Infinity;

  for ( let k = 0; k < letterIndex; k++ ) {
    const r = radius[ k ] * BUILD_SIZE;

    wordMinX = Math.min(
      wordMinX,
      centreX[ k ] - r
    );
    wordMaxX = Math.max(
      wordMaxX,
      centreX[ k ] + r
    );
    wordMinY = Math.min(
      wordMinY,
      centreY[ k ] - r
    );
    wordMaxY = Math.max(
      wordMaxY,
      centreY[ k ] + r
    );
  }

  const wordCtrX = ( wordMinX + wordMaxX ) / 2;
  const wordCtrY = ( wordMinY + wordMaxY ) / 2;
  const offsets = new Float32Array( MAX_LETTERS * 2 );

  let wordRadius = 0;

  for ( let k = 0; k < letterIndex; k++ ) {
    const ox = ( centreX[ k ] - wordCtrX ) / BUILD_SIZE;
    const oy = -( centreY[ k ] - wordCtrY ) / BUILD_SIZE;

    offsets[ k * 2 ] = ox;
    offsets[ k * 2 + 1 ] = oy;
    wordRadius = Math.max(
      wordRadius,
      Math.hypot(
        ox,
        oy
      ) + radius[ k ]
    );
  }

  return {
    count: letterIndex,
    seg,
    segCount,
    radius,
    offsets,
    wordRadius,
    halfW: ( wordMaxX - wordMinX ) / 2 / BUILD_SIZE,
    halfH: ( wordMaxY - wordMinY ) / 2 / BUILD_SIZE
  };
}

export function getLetterField( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    cfg.text,
    fontFamily,
    cfg.sampleFactor,
    cfg.simplifyThreshold,
    cfg.contourBreak,
    cfg.spacing
  ].join( "|" );

  const cached = geometryMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const field = buildLetterField( cfg );

  // Font still loading → don't cache the null, retry next frame.
  if ( !field ) {
    return null;
  }

  geometryMemo.set(
    key,
    field
  );

  if ( geometryMemo.size > GEOMETRY_MEMO_MAX ) {
    geometryMemo.delete( geometryMemo.keys().next().value );
  }

  return field;
}
