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
// Shared maths for the "voronoi" category — the famous Processing-era diagram.
//
// A set of moving sites partitions the plane into cells: every point belongs to
// its nearest site. Rendered brute-force (nearest-of-N per pixel) on a low-res
// buffer, which is exactly the classic approach and keeps the distance metric
// fully swappable (Euclidean / Manhattan / Chebyshev / Minkowski). The two
// nearest distances (F1, F2) also drive Worley / cellular-noise looks.
// ─────────────────────────────────────────────────────────────────────────────

/* ------------------------------------------------------------------ */
/*  Distance metrics. Euclidean returns the SQUARED distance (cheaper  */
/*  and order-preserving); callers sqrt only the 1–2 values they need. */
/* ------------------------------------------------------------------ */

export const METRICS = {
  euclidean: (
    dx, dy
  ) => dx * dx + dy * dy,
  manhattan: (
    dx, dy
  ) => Math.abs( dx ) + Math.abs( dy ),
  chebyshev: (
    dx, dy
  ) => Math.max(
    Math.abs( dx ),
    Math.abs( dy )
  ),
  minkowski: (
    dx, dy, pexp
  ) => Math.pow(
    Math.abs( dx ),
    pexp
  ) + Math.pow(
    Math.abs( dy ),
    pexp
  )
};

export const METRIC_NAMES = Object.keys( METRICS );

/* ------------------------------------------------------------------ */
/*  Sites                                                             */
/* ------------------------------------------------------------------ */

/**
 * Build a deterministic set of sites. Layouts:
 *   • random      — uniform jitter across the frame.
 *   • grid-jitter — near-regular lattice with per-cell jitter (relaxed look).
 *   • ring        — points on a circle (kaleidoscopic cells).
 */
export function createSites( {
  count,
  seed,
  width,
  height,
  layout = "random",
  margin = 0.06
} ) {
  const rng = mulberry32( Math.floor( seed * 2654435761 ) >>> 0 );
  const sites = [];
  const span = 1 - 2 * margin;

  const pushSite = (
    bx, by, rngLocal
  ) => {
    sites.push( {
      baseX: bx,
      baseY: by,
      x: bx,
      y: by,
      ampX: 0.02 + rngLocal() * 0.08,
      ampY: 0.02 + rngLocal() * 0.08,
      freqX: 1 + Math.floor( rngLocal() * 3 ),
      freqY: 1 + Math.floor( rngLocal() * 3 ),
      phaseX: rngLocal() * Math.PI * 2,
      phaseY: rngLocal() * Math.PI * 2,
      noiseSeedX: rngLocal() * 1000,
      noiseSeedY: rngLocal() * 1000 + 500,
      vx: rngLocal() * 2 - 1,
      vy: rngLocal() * 2 - 1,
      colorT: rngLocal()
    } );
  };

  if ( layout === "ring" ) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const radius = Math.min(
      width,
      height
    ) * 0.36;

    for ( let i = 0; i < count; i++ ) {
      const a = ( i / count ) * Math.PI * 2;

      pushSite(
        cx + Math.cos( a ) * radius,
        cy + Math.sin( a ) * radius,
        rng
      );
    }
  } else if ( layout === "grid-jitter" ) {
    const aspect = width / height;
    const colsN = Math.max(
      1,
      Math.round( Math.sqrt( count * aspect ) )
    );
    const rowsN = Math.max(
      1,
      Math.ceil( count / colsN )
    );

    for ( let i = 0; i < count; i++ ) {
      const gx = i % colsN;
      const gy = Math.floor( i / colsN );
      const jx = ( rng() - 0.5 ) * 0.9;
      const jy = ( rng() - 0.5 ) * 0.9;

      pushSite(
        width * margin + ( ( gx + 0.5 + jx ) / colsN ) * width * span,
        height * margin + ( ( gy + 0.5 + jy ) / rowsN ) * height * span,
        rng
      );
    }
  } else {
    for ( let i = 0; i < count; i++ ) {
      pushSite(
        width * ( margin + rng() * span ),
        height * ( margin + rng() * span ),
        rng
      );
    }
  }

  return sites;
}

/** Animate sites in place — same motion modes as the metaballs. */
export function animateSites(
  sites, {
    mode = "drift",
    angle = 0,
    motion = 1,
    speed = 1,
    width,
    height
  }
) {
  const p = getP5();

  // "drift" walks a closed circle (cos/sin of `a`) through noise space, and
  // "orbit" oscillates at `a * freqX/freqY` (both integer per-site) — both are
  // loop-exact only when `a` itself completes a whole number of turns per
  // loop, so `speed` is snapped here. "bounce" accumulates velocity frame to
  // frame and doesn't use `a` at all, so it's unaffected (and unfixable).
  const speedTurns = Math.round( speed );
  const a = angle * speedTurns;
  const cx = Math.cos( a );
  const sx = Math.sin( a );

  for ( let i = 0; i < sites.length; i++ ) {
    const s = sites[ i ];

    if ( mode === "orbit" ) {
      s.x = s.baseX + Math.cos( a * s.freqX + s.phaseX ) * s.ampX * width * motion;
      s.y = s.baseY + Math.sin( a * s.freqY + s.phaseY ) * s.ampY * height * motion;
    } else if ( mode === "bounce" ) {
      s.x += s.vx * speed;
      s.y += s.vy * speed;

      if ( s.x < 0 || s.x > width ) {
        s.vx *= -1;
        s.x = Math.max(
          0,
          Math.min(
            width,
            s.x
          )
        );
      }

      if ( s.y < 0 || s.y > height ) {
        s.vy *= -1;
        s.y = Math.max(
          0,
          Math.min(
            height,
            s.y
          )
        );
      }
    } else {
      const nx = p.noise(
        s.noiseSeedX + cx * 0.5,
        s.noiseSeedX + sx * 0.5
      );
      const ny = p.noise(
        s.noiseSeedY + cx * 0.5,
        s.noiseSeedY + sx * 0.5
      );

      s.x = s.baseX + ( nx - 0.5 ) * 6 * s.ampX * width * motion;
      s.y = s.baseY + ( ny - 0.5 ) * 6 * s.ampY * height * motion;
    }
  }
}

/**
 * Turn live interaction pointers (from `getPointers`) into Voronoi sites. Each
 * pointer becomes a site at its position; `startIndex` offsets the colour hash
 * so injected sites keep distinct, stable hues next to the procedural ones.
 */
export function pointersToSites(
  pointers, startIndex = 0
) {
  const sites = [];

  for ( let i = 0; i < pointers.length; i++ ) {
    const pt = pointers[ i ];

    sites.push( {
      x: pt.x,
      y: pt.y,
      // Golden-ratio hash → well-spread, deterministic hues per pointer.
      colorT: ( ( startIndex + i ) * 0.6180339887 ) % 1
    } );
  }

  return sites;
}

/**
 * Combine procedural sites with interaction pointers per mix mode: "add" appends
 * pointer sites, "replace" uses only pointer sites, "off" (or no pointers) keeps
 * the procedural set.
 */
export function combineSites(
  procedural, pointers, mode
) {
  if ( mode === "replace" ) {
    return pointersToSites(
      pointers,
      0
    );
  }

  if ( mode === "off" || !pointers || pointers.length === 0 ) {
    return procedural;
  }

  return procedural.concat( pointersToSites(
    pointers,
    procedural.length
  ) );
}

/* ------------------------------------------------------------------ */
/*  Nearest-site query                                                */
/* ------------------------------------------------------------------ */

/**
 * Find the two nearest sites to (x,y) under `metricFn`. Writes into the reused
 * `result` object { i1, d1, i2, d2 } (no allocation on the hot path). Distances
 * are in the metric's own units (squared, for Euclidean).
 */
export function nearestTwo(
  sites, x, y, metricFn, pexp, result
) {
  let i1 = -1;
  let i2 = -1;
  let d1 = Infinity;
  let d2 = Infinity;

  for ( let i = 0; i < sites.length; i++ ) {
    const s = sites[ i ];
    const d = metricFn(
      x - s.x,
      y - s.y,
      pexp
    );

    if ( d < d1 ) {
      d2 = d1;
      i2 = i1;
      d1 = d;
      i1 = i;
    } else if ( d < d2 ) {
      d2 = d;
      i2 = i;
    }
  }

  result.i1 = i1;
  result.d1 = d1;
  result.i2 = i2;
  result.d2 = d2;

  return result;
}
