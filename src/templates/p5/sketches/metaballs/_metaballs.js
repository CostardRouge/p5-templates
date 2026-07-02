import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  mulberry32,
  palette,
  PALETTE_NAMES
} from "../_shared/palette.js";

export {
  mulberry32,
  palette,
  PALETTE_NAMES
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared maths for the "metaballs" category.
//
// A faithful, optimised port of Jamie Wong's "Metaballs and Marching Squares"
// (https://jamie-wong.com/2014/08/19/metaballs-and-marching-squares/).
//
//   • metaball scalar field:  f(x,y) = Σ rᵢ² / ((x-xᵢ)² + (y-yᵢ)²)
//     a point is "inside" the surface when f(x,y) > threshold (1 by default).
//   • marching squares: sample f on a regular grid, classify every 2×2 cell into
//     one of 16 cases from its four corners, then emit the contour (and, for the
//     blob variants, the filled inside-polygon) using *linear interpolation* of
//     the crossing point along each edge so the iso-line is smooth.
//
// Everything here is allocation-free on the hot path: the field is written into a
// caller-owned Float32Array that is only re-allocated when the grid changes.
// ─────────────────────────────────────────────────────────────────────────────

const EPSILON = 1e-6;

/* ------------------------------------------------------------------ */
/*  Balls                                                             */
/* ------------------------------------------------------------------ */

/**
 * Build a deterministic set of metaballs. Radii are stored both as `r0` (base)
 * and `r` (animated) so a radius pulse never drifts away from its seed value.
 */
export function createBalls( {
  count,
  seed,
  minRadius,
  maxRadius,
  width,
  height,
  margin = 0.12
} ) {
  const rng = mulberry32( Math.floor( seed * 2654435761 ) >>> 0 );
  const balls = [];
  const span = 1 - 2 * margin;

  for ( let i = 0; i < count; i++ ) {
    const r = minRadius + rng() * Math.max(
      0,
      maxRadius - minRadius
    );
    const baseX = width * ( margin + rng() * span );
    const baseY = height * ( margin + rng() * span );

    balls.push( {
      baseX,
      baseY,
      x: baseX,
      y: baseY,
      r0: r,
      r,
      ampX: 0.04 + rng() * 0.13,
      ampY: 0.04 + rng() * 0.13,
      freqX: 1 + Math.floor( rng() * 3 ),
      freqY: 1 + Math.floor( rng() * 3 ),
      phaseX: rng() * Math.PI * 2,
      phaseY: rng() * Math.PI * 2,
      pulsePhase: rng() * Math.PI * 2,
      noiseSeedX: rng() * 1000,
      noiseSeedY: rng() * 1000 + 500,
      vx: rng() * 2 - 1,
      vy: rng() * 2 - 1
    } );
  }

  return balls;
}

/**
 * Animate the balls in place. Three modes:
 *   • drift  — circular Perlin-noise offset; seamless loop (default).
 *   • orbit  — Lissajous ellipse per ball; seamless loop.
 *   • bounce — classic wall-bounce integration; lively but not loop-safe.
 * `angle` is the loop phase (0 → TAU); `motion` scales amplitude; `radiusPulse`
 * breathes the radii. `speed` is best kept integer so drift/orbit stay seamless.
 */
export function animateBalls(
  balls, {
    mode = "drift",
    angle = 0,
    motion = 1,
    speed = 1,
    radiusPulse = 0,
    width,
    height
  }
) {
  const p = getP5();

  // "drift" walks a closed circle (cos/sin of `a`) through noise space, and
  // "orbit" oscillates at `a * freqX/freqY` (both integer per-ball) — both are
  // loop-exact only when `a` itself completes a whole number of turns per
  // loop, so `speed` is snapped here. The radius pulse below also rides on
  // `a`, so it closes too. "bounce" accumulates velocity frame to frame and
  // doesn't use `a` for position, so it's unaffected (and unfixable).
  const speedTurns = Math.round( speed );
  const a = angle * speedTurns;
  const cx = Math.cos( a );
  const sx = Math.sin( a );

  for ( let i = 0; i < balls.length; i++ ) {
    const b = balls[ i ];

    if ( mode === "orbit" ) {
      b.x = b.baseX + Math.cos( a * b.freqX + b.phaseX ) * b.ampX * width * motion;
      b.y = b.baseY + Math.sin( a * b.freqY + b.phaseY ) * b.ampY * height * motion;
    } else if ( mode === "bounce" ) {
      const r = b.r0;

      b.x += b.vx * speed;
      b.y += b.vy * speed;

      if ( b.x < r || b.x > width - r ) {
        b.vx *= -1;
        b.x = Math.max(
          r,
          Math.min(
            width - r,
            b.x
          )
        );
      }

      if ( b.y < r || b.y > height - r ) {
        b.vy *= -1;
        b.y = Math.max(
          r,
          Math.min(
            height - r,
            b.y
          )
        );
      }
    } else {
      const nx = p.noise(
        b.noiseSeedX + cx * 0.5,
        b.noiseSeedX + sx * 0.5
      );
      const ny = p.noise(
        b.noiseSeedY + cx * 0.5,
        b.noiseSeedY + sx * 0.5
      );

      b.x = b.baseX + ( nx - 0.5 ) * 6 * b.ampX * width * motion;
      b.y = b.baseY + ( ny - 0.5 ) * 6 * b.ampY * height * motion;
    }

    b.r = b.r0 * ( 1 + Math.sin( a + b.pulsePhase ) * radiusPulse );
  }
}

/**
 * Turn live interaction pointers (from `getPointers`) into metaballs. Each
 * pointer becomes a ball at its position with a uniform radius, so a mouse,
 * fingertip, audio band, orbit source, … all push the field around.
 */
export function pointersToBalls(
  pointers, radius
) {
  const balls = [];

  for ( let i = 0; i < pointers.length; i++ ) {
    const pt = pointers[ i ];

    balls.push( {
      x: pt.x,
      y: pt.y,
      r: radius
    } );
  }

  return balls;
}

/**
 * Combine the procedural balls with interaction pointers according to the mix
 * mode: "add" appends pointer balls, "replace" uses only pointer balls, "off"
 * (or no pointers) keeps the procedural set untouched.
 */
export function combineBalls(
  procedural, pointers, radius, mode
) {
  if ( mode === "replace" ) {
    return pointersToBalls(
      pointers,
      radius
    );
  }

  if ( mode === "off" || !pointers || pointers.length === 0 ) {
    return procedural;
  }

  return procedural.concat( pointersToBalls(
    pointers,
    radius
  ) );
}

/* ------------------------------------------------------------------ */
/*  Scalar field                                                      */
/* ------------------------------------------------------------------ */

/** f(x,y) = Σ rᵢ² / dᵢ² — the metaball influence sum at a single point. */
export function sampleField(
  balls, x, y
) {
  let sum = 0;

  for ( let i = 0; i < balls.length; i++ ) {
    const b = balls[ i ];
    const dx = x - b.x;
    const dy = y - b.y;

    sum += ( b.r * b.r ) / ( dx * dx + dy * dy + EPSILON );
  }

  return sum;
}

/**
 * Evaluate the field on a (cols+1)×(rows+1) lattice of grid *nodes* and write the
 * result into `out` (re-used between frames). Returns `out`. Node (gx,gy) maps to
 * pixel (gx·cellW, gy·cellH); index = gy·(cols+1) + gx.
 */
export function buildFieldGrid(
  balls, cols, rows, cellW, cellH, out
) {
  const w = cols + 1;
  const h = rows + 1;
  const size = w * h;
  const field = out && out.length === size ? out : new Float32Array( size );

  for ( let gy = 0; gy < h; gy++ ) {
    const y = gy * cellH;
    const rowOffset = gy * w;

    for ( let gx = 0; gx < w; gx++ ) {
      field[ rowOffset + gx ] = sampleField(
        balls,
        gx * cellW,
        y
      );
    }
  }

  return field;
}

/* ------------------------------------------------------------------ */
/*  Marching squares                                                  */
/* ------------------------------------------------------------------ */

/** Linear crossing fraction of `threshold` between corner values v0 → v1. */
function crossing(
  v0, v1, threshold
) {
  const d = v1 - v0;

  if ( Math.abs( d ) < EPSILON ) {
    return 0.5;
  }

  return ( threshold - v0 ) / d;
}

/**
 * Walk every cell and invoke `onSegment(x1,y1,x2,y2, caseId)` for each contour
 * segment. With `interpolate` the crossing points are placed by linear
 * interpolation of the field (smooth iso-line); without it they sit on edge
 * midpoints (the blocky "classic" look). Saddle cells (5 & 10) are disambiguated
 * with the cell-centre average so blobs never connect through a pinch.
 */
export function marchingSquaresContour(
  field, cols, rows, cellW, cellH, threshold, interpolate, onSegment
) {
  const w = cols + 1;

  for ( let gy = 0; gy < rows; gy++ ) {
    const y0 = gy * cellH;
    const y1 = y0 + cellH;
    const top = gy * w;
    const bottom = top + w;

    for ( let gx = 0; gx < cols; gx++ ) {
      const x0 = gx * cellW;
      const x1 = x0 + cellW;

      const tl = field[ top + gx ];
      const tr = field[ top + gx + 1 ];
      const br = field[ bottom + gx + 1 ];
      const bl = field[ bottom + gx ];

      let id = 0;

      if ( tl > threshold ) {
        id |= 8;
      }
      if ( tr > threshold ) {
        id |= 4;
      }
      if ( br > threshold ) {
        id |= 2;
      }
      if ( bl > threshold ) {
        id |= 1;
      }

      if ( id === 0 || id === 15 ) {
        continue;
      }

      // Edge crossing points: a=top, b=right, c=bottom, d=left.
      const ax = interpolate ? x0 + crossing(
        tl,
        tr,
        threshold
      ) * cellW : x0 + cellW * 0.5;
      const ay = y0;
      const bx = x1;
      const by = interpolate ? y0 + crossing(
        tr,
        br,
        threshold
      ) * cellH : y0 + cellH * 0.5;
      const cx = interpolate ? x0 + crossing(
        bl,
        br,
        threshold
      ) * cellW : x0 + cellW * 0.5;
      const cy = y1;
      const dx = x0;
      const dy = interpolate ? y0 + crossing(
        tl,
        bl,
        threshold
      ) * cellH : y0 + cellH * 0.5;

      let resolved = id;

      if ( id === 5 || id === 10 ) {
        const center = ( tl + tr + br + bl ) * 0.25;

        // When the centre sits inside, flip the saddle pairing.
        if ( center > threshold ) {
          resolved = id === 5 ? 10 : 5;
        }
      }

      switch ( resolved ) {
        case 1:
        case 14:
          onSegment(
            dx,
            dy,
            cx,
            cy,
            id
          );
          break;
        case 2:
        case 13:
          onSegment(
            cx,
            cy,
            bx,
            by,
            id
          );
          break;
        case 3:
        case 12:
          onSegment(
            dx,
            dy,
            bx,
            by,
            id
          );
          break;
        case 4:
        case 11:
          onSegment(
            ax,
            ay,
            bx,
            by,
            id
          );
          break;
        case 6:
        case 9:
          onSegment(
            ax,
            ay,
            cx,
            cy,
            id
          );
          break;
        case 7:
        case 8:
          onSegment(
            ax,
            ay,
            dx,
            dy,
            id
          );
          break;
        case 5:
          onSegment(
            ax,
            ay,
            bx,
            by,
            id
          );
          onSegment(
            cx,
            cy,
            dx,
            dy,
            id
          );
          break;
        case 10:
          onSegment(
            ax,
            ay,
            dx,
            dy,
            id
          );
          onSegment(
            cx,
            cy,
            bx,
            by,
            id
          );
          break;
        default:
          break;
      }
    }
  }
}

/**
 * Like `marchingSquaresContour` but emits the *filled* inside region of every
 * cell as a flat array of polygon vertices [x0,y0, x1,y1, …] via
 * `onPolygon(verts, caseId)`. Used by the gooey blob variants. Saddle cells emit
 * two polygons.
 */
export function marchingSquaresFill(
  field, cols, rows, cellW, cellH, threshold, interpolate, onPolygon
) {
  const w = cols + 1;

  for ( let gy = 0; gy < rows; gy++ ) {
    const y0 = gy * cellH;
    const y1 = y0 + cellH;
    const top = gy * w;
    const bottom = top + w;

    for ( let gx = 0; gx < cols; gx++ ) {
      const x0 = gx * cellW;
      const x1 = x0 + cellW;

      const tl = field[ top + gx ];
      const tr = field[ top + gx + 1 ];
      const br = field[ bottom + gx + 1 ];
      const bl = field[ bottom + gx ];

      let id = 0;

      if ( tl > threshold ) {
        id |= 8;
      }
      if ( tr > threshold ) {
        id |= 4;
      }
      if ( br > threshold ) {
        id |= 2;
      }
      if ( bl > threshold ) {
        id |= 1;
      }

      if ( id === 0 ) {
        continue;
      }

      if ( id === 15 ) {
        onPolygon(
          [
            x0,
            y0,
            x1,
            y0,
            x1,
            y1,
            x0,
            y1
          ],
          id
        );
        continue;
      }

      // Edge crossing points (top, right, bottom, left).
      const ax = interpolate ? x0 + crossing(
        tl,
        tr,
        threshold
      ) * cellW : x0 + cellW * 0.5;
      const bY = interpolate ? y0 + crossing(
        tr,
        br,
        threshold
      ) * cellH : y0 + cellH * 0.5;
      const cx = interpolate ? x0 + crossing(
        bl,
        br,
        threshold
      ) * cellW : x0 + cellW * 0.5;
      const dY = interpolate ? y0 + crossing(
        tl,
        bl,
        threshold
      ) * cellH : y0 + cellH * 0.5;

      const A = [
        ax,
        y0
      ];
      const B = [
        x1,
        bY
      ];
      const C = [
        cx,
        y1
      ];
      const D = [
        x0,
        dY
      ];
      const TL = [
        x0,
        y0
      ];
      const TR = [
        x1,
        y0
      ];
      const BR = [
        x1,
        y1
      ];
      const BL = [
        x0,
        y1
      ];

      switch ( id ) {
        case 1:
          emit(
            onPolygon,
            id,
            D,
            C,
            BL
          );
          break;
        case 2:
          emit(
            onPolygon,
            id,
            C,
            B,
            BR
          );
          break;
        case 3:
          emit(
            onPolygon,
            id,
            D,
            B,
            BR,
            BL
          );
          break;
        case 4:
          emit(
            onPolygon,
            id,
            A,
            TR,
            B
          );
          break;
        case 5:
          emit(
            onPolygon,
            id,
            A,
            TR,
            B
          );
          emit(
            onPolygon,
            id,
            D,
            C,
            BL
          );
          break;
        case 6:
          emit(
            onPolygon,
            id,
            A,
            TR,
            BR,
            C
          );
          break;
        case 7:
          emit(
            onPolygon,
            id,
            A,
            TR,
            BR,
            BL,
            D
          );
          break;
        case 8:
          emit(
            onPolygon,
            id,
            TL,
            A,
            D
          );
          break;
        case 9:
          emit(
            onPolygon,
            id,
            TL,
            A,
            C,
            BL
          );
          break;
        case 10:
          emit(
            onPolygon,
            id,
            TL,
            A,
            D
          );
          emit(
            onPolygon,
            id,
            B,
            BR,
            C
          );
          break;
        case 11:
          emit(
            onPolygon,
            id,
            TL,
            A,
            B,
            BR,
            BL
          );
          break;
        case 12:
          emit(
            onPolygon,
            id,
            TL,
            TR,
            B,
            D
          );
          break;
        case 13:
          emit(
            onPolygon,
            id,
            TL,
            TR,
            B,
            C,
            BL
          );
          break;
        case 14:
          emit(
            onPolygon,
            id,
            TL,
            TR,
            BR,
            C,
            D
          );
          break;
        default:
          break;
      }
    }
  }
}

function emit(
  onPolygon, id, ...points
) {
  const verts = [];

  for ( let i = 0; i < points.length; i++ ) {
    verts.push(
      points[ i ][ 0 ],
      points[ i ][ 1 ]
    );
  }

  onPolygon(
    verts,
    id
  );
}

/* ------------------------------------------------------------------ */
/*  Field → colour mapping                                            */
/* ------------------------------------------------------------------ */

/** Smooth, bounded mapping of a raw field value to [0,1] for colouring. */
export function fieldToUnit(
  value, threshold, gamma = 1
) {
  const t = value / ( value + threshold );

  return gamma === 1 ? t : Math.pow(
    t,
    gamma
  );
}
