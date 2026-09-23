// ─────────────────────────────────────────────────────────────────────────────
// The INK: a rasterised glyph as bytes, and what a grid of points reads off it.
//
// `sculpt-v2-letter-relief` reads its letter one way — a point is on the ink
// or it is not — and that is enough to lift it. The typographic sculpts built
// after it (v5 … v9) want more from the same raster:
//
//   • the AREA of ink under a cell, not the bit under its centre, so a dot can
//     be sized like a halftone (`coverageAt`);
//   • how FAR a point is from the ink, signed, so the sheet can contract onto
//     a letter, ripple away from it, or rank its nodes by that distance
//     (`distanceField`, `sampleField`, `distanceAt`);
//   • which WAY the nearest stroke runs, so a dash can lie along it
//     (`orientationAt`);
//   • a contraction of the grid onto the ink from all of that (`pinchOffsets`).
//
// Everything here is a pure function of a mask — `{ data: Uint8Array, w, h }`,
// one byte per pixel, lit where the ink is, spanning the sheet 0..1 in u
// (across) and v (down) — and the rasteriser that makes one from a font lives
// in `_raster.js`, the only p5-bound file of the pair. The distance field is
// memoised ON the mask (`fieldOf`), so it is computed once per glyph.
//
// Units: a mask pixel is square in world space (the mask has the sheet's
// aspect), so pixel-space directions are sheet directions; distances come out
// in pixels and the callers convert to cells through `pixelsPerCell`.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MAX_OFFSET
} from "./_mesh.js";

const INF = 1e20;
const TAU = Math.PI * 2;

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

/** 1 where the pixel under ( u, v ) is lit, 0 elsewhere or off the sheet. */
export function inkAt(
  mask, u, v
) {
  if ( u < 0 || u >= 1 || v < 0 || v >= 1 ) {
    return 0;
  }

  return mask.data[ ( ( v * mask.h ) | 0 ) * mask.w + ( ( u * mask.w ) | 0 ) ] > 127 ? 1 : 0;
}

/**
 * Fraction of eight samples on a circle of radius `r` (sheet-height units)
 * that are on the ink: 1 deep inside a stroke, 0 well outside.
 */
export function ringInside(
  mask, u, v, r, aspect
) {
  let inside = 0;

  for ( let k = 0; k < 8; k++ ) {
    const a = ( k * Math.PI ) / 4;

    inside += inkAt(
      mask,
      u + ( Math.cos( a ) * r ) / aspect,
      v + Math.sin( a ) * r
    );
  }

  return inside / 8;
}

/**
 * The ink's AREA under a box centred on ( u, v ) with half extents ( ru, rv )
 * in sheet units — `samples` × `samples` point samples, so a cell astride the
 * outline reads a fraction rather than a bit. That fraction is what sizes a
 * halftone dot.
 */
export function coverageAt(
  mask, u, v, ru, rv, samples = 4
) {
  const s = Math.max(
    1,
    Math.round( samples )
  );
  let lit = 0;

  for ( let j = 0; j < s; j++ ) {
    const fv = ( ( j + 0.5 ) / s - 0.5 ) * 2 * rv;

    for ( let i = 0; i < s; i++ ) {
      const fu = ( ( i + 0.5 ) / s - 0.5 ) * 2 * ru;

      lit += inkAt(
        mask,
        u + fu,
        v + fv
      );
    }
  }

  return lit / ( s * s );
}

// Felzenszwalb & Huttenlocher's 1D squared-distance transform of a sampled
// function: `f[q]` is 0 at a seed and INF elsewhere, `d[q]` comes out as the
// squared distance to the nearest seed. `v` / `z` are integer / float scratch
// of length n and n + 1.
function edt1d(
  f, n, d, v, z
) {
  let k = 0;

  v[ 0 ] = 0;
  z[ 0 ] = -INF;
  z[ 1 ] = INF;

  for ( let q = 1; q < n; q++ ) {
    let s = ( ( f[ q ] + q * q ) - ( f[ v[ k ] ] + v[ k ] * v[ k ] ) ) / ( 2 * q - 2 * v[ k ] );

    while ( s <= z[ k ] ) {
      k--;
      s = ( ( f[ q ] + q * q ) - ( f[ v[ k ] ] + v[ k ] * v[ k ] ) ) / ( 2 * q - 2 * v[ k ] );
    }

    k++;
    v[ k ] = q;
    z[ k ] = s;
    z[ k + 1 ] = INF;
  }

  k = 0;

  for ( let q = 0; q < n; q++ ) {
    while ( z[ k + 1 ] < q ) {
      k++;
    }

    d[ q ] = ( q - v[ k ] ) * ( q - v[ k ] ) + f[ v[ k ] ];
  }
}

// Squared distance from every pixel to the nearest seed, in place over
// `grid` (w × h, 0 at a seed, INF elsewhere). Rows first, then columns.
function edt2d(
  grid, w, h
) {
  const n = Math.max(
    w,
    h
  );
  const f = new Float64Array( n );
  const d = new Float64Array( n );
  const v = new Int32Array( n );
  const z = new Float64Array( n + 1 );

  for ( let y = 0; y < h; y++ ) {
    const row = y * w;

    for ( let x = 0; x < w; x++ ) {
      f[ x ] = grid[ row + x ];
    }

    edt1d(
      f,
      w,
      d,
      v,
      z
    );

    for ( let x = 0; x < w; x++ ) {
      grid[ row + x ] = d[ x ];
    }
  }

  for ( let x = 0; x < w; x++ ) {
    for ( let y = 0; y < h; y++ ) {
      f[ y ] = grid[ y * w + x ];
    }

    edt1d(
      f,
      h,
      d,
      v,
      z
    );

    for ( let y = 0; y < h; y++ ) {
      grid[ y * w + x ] = d[ y ];
    }
  }
}

/**
 * The signed distance, in pixels, from every pixel of the mask to the ink's
 * outline: negative inside the ink (how deep), positive outside (how far),
 * exact Euclidean on the pixel lattice. A mask with no ink at all is INF
 * everywhere (nothing is near), one that is all ink is -INF.
 *
 * @param {{ data: Uint8Array, w: number, h: number }} mask
 * @param {Float32Array} [out] w × h
 * @returns {Float32Array}
 */
export function distanceField(
  mask, out = null
) {
  const {
    data,
    w,
    h
  } = mask;
  const count = w * h;
  const field = out && out.length === count ? out : new Float32Array( count );
  const outside = new Float64Array( count );
  const inside = new Float64Array( count );
  let anyInk = false;
  let anyAir = false;

  for ( let i = 0; i < count; i++ ) {
    const lit = data[ i ] > 127;

    outside[ i ] = lit ? 0 : INF;
    inside[ i ] = lit ? INF : 0;
    anyInk = anyInk || lit;
    anyAir = anyAir || !lit;
  }

  if ( !anyInk ) {
    field.fill( INF );

    return field;
  }

  if ( !anyAir ) {
    field.fill( -INF );

    return field;
  }

  edt2d(
    outside,
    w,
    h
  );
  edt2d(
    inside,
    w,
    h
  );

  for ( let i = 0; i < count; i++ ) {
    field[ i ] = data[ i ] > 127
      ? -Math.sqrt( inside[ i ] )
      : Math.sqrt( outside[ i ] );
  }

  return field;
}

/** The mask's distance field, computed once and kept on the mask. */
export function fieldOf( mask ) {
  if ( !mask.field ) {
    mask.field = distanceField( mask );
  }

  return mask.field;
}

/**
 * Bilinear sample of a per-pixel field at ( u, v ) sheet coordinates, clamped
 * to the mask so a point just off the sheet reads the edge.
 */
export function sampleField(
  field, mask, u, v
) {
  const {
    w,
    h
  } = mask;
  const x = clamp(
    u * w - 0.5,
    0,
    w - 1
  );
  const y = clamp(
    v * h - 0.5,
    0,
    h - 1
  );
  const x0 = Math.floor( x );
  const y0 = Math.floor( y );
  const x1 = Math.min(
    x0 + 1,
    w - 1
  );
  const y1 = Math.min(
    y0 + 1,
    h - 1
  );
  const fx = x - x0;
  const fy = y - y0;
  const top = field[ y0 * w + x0 ] * ( 1 - fx ) + field[ y0 * w + x1 ] * fx;
  const bottom = field[ y1 * w + x0 ] * ( 1 - fx ) + field[ y1 * w + x1 ] * fx;

  return top * ( 1 - fy ) + bottom * fy;
}

/** Mask pixels per grid cell (the mask spans the sheet, the grid too). */
export function pixelsPerCell(
  mask, grid
) {
  return mask.w / grid.cols;
}

/**
 * Signed distance from ( u, v ) to the ink, in CELLS of the given grid.
 * Negative inside the ink.
 */
export function distanceAt(
  mask, grid, u, v
) {
  return sampleField(
    fieldOf( mask ),
    mask,
    u,
    v
  ) / pixelsPerCell(
    mask,
    grid
  );
}

/**
 * The distance field's gradient at ( u, v ), by central differences one pixel
 * apart, in pixel units — so it is (close to) a unit vector pointing AWAY from
 * the ink outside it and toward the outline inside it, and shrinks to nothing
 * on the medial axis of a stroke, where the two sides cancel. Written into
 * `out` as [ gu, gv ] (u right, v down).
 */
export function gradientAt(
  field, mask, u, v, out
) {
  const du = 1 / mask.w;
  const dv = 1 / mask.h;

  out[ 0 ] = ( sampleField(
    field,
    mask,
    u + du,
    v
  ) - sampleField(
    field,
    mask,
    u - du,
    v
  ) ) * 0.5;
  out[ 1 ] = ( sampleField(
    field,
    mask,
    u,
    v + dv
  ) - sampleField(
    field,
    mask,
    u,
    v - dv
  ) ) * 0.5;

  return out;
}

const gradScratch = new Float32Array( 2 );

/**
 * Which way the nearest stroke RUNS at ( u, v ): the tangent of the distance
 * field's iso-lines, averaged over a small cross of samples `radius` sheet
 * units wide. A direction has no head or tail (a dash is the same turned by
 * 180°), so the average is taken on the DOUBLED angle — two opposite tangents
 * agree instead of cancelling — and `strength` is how much the samples agree
 * (1 on a straight stroke, near 0 at a junction or a corner).
 *
 * @returns {{ angle: number, strength: number }} angle in [ 0, π ), on the
 *   sheet (0 = along u, π / 2 = along v)
 */
export function orientationAt(
  field, mask, u, v, radius, aspect
) {
  const offsets = [
    [
      0,
      0
    ],
    [
      radius / aspect,
      0
    ],
    [
      -radius / aspect,
      0
    ],
    [
      0,
      radius
    ],
    [
      0,
      -radius
    ]
  ];
  let cx = 0;
  let cy = 0;
  let total = 0;

  for ( const [
    ou,
    ov
  ] of offsets ) {
    gradientAt(
      field,
      mask,
      u + ou,
      v + ov,
      gradScratch
    );

    const gu = gradScratch[ 0 ];
    const gv = gradScratch[ 1 ];
    const weight = Math.hypot(
      gu,
      gv
    );

    if ( weight < 1e-6 ) {
      continue;
    }

    // The tangent is the gradient turned by 90°; doubling its angle turns
    // the gradient's doubled angle by 180°, hence the negation.
    const g2 = 2 * Math.atan2(
      gv,
      gu
    );

    cx -= Math.cos( g2 ) * weight;
    cy -= Math.sin( g2 ) * weight;
    total += weight;
  }

  if ( total < 1e-6 ) {
    return {
      angle: 0,
      strength: 0
    };
  }

  const angle = ( ( Math.atan2(
    cy,
    cx
  ) / 2 ) % Math.PI + Math.PI ) % Math.PI;

  return {
    angle,
    strength: Math.hypot(
      cx,
      cy
    ) / total
  };
}

/**
 * Contract the grid onto the ink: every point within `reach` cells of a
 * letter slides toward it along the distance field's downhill direction —
 * from outside, toward the outline, never past it; from inside, toward the
 * stroke's medial axis, where the gradient dies and the pull with it. The
 * result is a mesh whose spacing shrinks where the letter is and stays at
 * rest everywhere else, which is the whole idea of `sculpt-v5-letter-pinch`.
 *
 * Offsets are written in CELL units (u right, v down), on top of the grid's
 * jitter, clamped to MAX_OFFSET so the shader's cell scan stays exact.
 *
 * @param {object} grid       buildGrid result
 * @param {object} mask       with its field (fieldOf)
 * @param {object} opts
 * @param {number} opts.pull      cells, how far an outside point may slide
 * @param {number} opts.reach     cells, how far from the ink the pull is felt
 * @param {number} [opts.inside=1] share of `pull` applied inside the ink
 * @param {Function} [opts.falloff] easing of the pull over `reach` (1 at the
 *   outline → 0 at `reach`)
 * @param {Float32Array} outX   count, receives jitter + pinch
 * @param {Float32Array} outZ
 * @param {Float32Array} [outAmount] count, 0..1 how much each point moved
 *   relative to `pull` (what the sketch orders the morph by)
 */
export function pinchOffsets(
  grid, mask, {
    pull,
    reach,
    inside = 1,
    falloff = ( x ) => x
  }, outX, outZ, outAmount = null
) {
  const field = fieldOf( mask );
  const ppc = pixelsPerCell(
    mask,
    grid
  );
  const {
    count,
    u,
    v,
    jx,
    jz
  } = grid;

  outX.set( jx );
  outZ.set( jz );

  if ( outAmount ) {
    outAmount.fill( 0 );
  }

  if ( pull <= 0 || reach <= 0 ) {
    return;
  }

  for ( let n = 0; n < count; n++ ) {
    const d = sampleField(
      field,
      mask,
      u[ n ],
      v[ n ]
    ) / ppc;

    if ( d >= reach || d > 1e6 ) {
      continue;
    }

    gradientAt(
      field,
      mask,
      u[ n ],
      v[ n ],
      gradScratch
    );

    const gu = gradScratch[ 0 ];
    const gv = gradScratch[ 1 ];
    const g = Math.hypot(
      gu,
      gv
    );

    if ( g < 1e-6 ) {
      continue;
    }

    let amount;

    if ( d > 0 ) {
      // Outside: toward the outline, and never past it.
      amount = Math.min(
        pull * falloff( clamp(
          1 - d / reach,
          0,
          1
        ) ),
        d
      );
    } else {
      // Inside: toward the axis, as far as the gradient carries.
      amount = pull * inside * Math.min(
        g,
        1
      );
    }

    if ( amount <= 0 ) {
      continue;
    }

    outX[ n ] = clamp(
      jx[ n ] - ( gu / g ) * amount,
      -MAX_OFFSET,
      MAX_OFFSET
    );
    outZ[ n ] = clamp(
      jz[ n ] - ( gv / g ) * amount,
      -MAX_OFFSET,
      MAX_OFFSET
    );

    if ( outAmount ) {
      outAmount[ n ] = clamp(
        amount / pull,
        0,
        1
      );
    }
  }
}

/**
 * Shortest-arc interpolation between two undirected angles (mod π): a dash
 * turning from `a` to `b` takes the shorter of the two ways round.
 */
export function lerpOrientation(
  a, b, t
) {
  let delta = ( ( b - a ) % Math.PI + Math.PI ) % Math.PI;

  if ( delta > Math.PI / 2 ) {
    delta -= Math.PI;
  }

  return ( ( a + delta * t ) % Math.PI + Math.PI ) % Math.PI;
}

/** A whole number of turns of the loop, as an angle — closes at progression 1. */
export function loopTurns(
  progression, turns
) {
  return progression * Math.round( turns ) * TAU;
}
