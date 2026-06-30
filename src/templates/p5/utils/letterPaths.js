/**
 * letterPaths — pure geometry helpers for the `letter-trace` category.
 *
 * The `letter-trace` sketches treat each glyph as a set of closed outlines that
 * a "pen" travels along: the camera follows the pen tip, or several pens reveal
 * the outline at once. All of that needs three primitives that have nothing to
 * do with p5 (so they live here and are unit-tested in isolation against plain
 * `{ x, y }` points):
 *
 *   1. splitContours    — `font.textToPoints` returns one flat, ordered list per
 *                         glyph; the jump from the end of one sub-outline (e.g.
 *                         the outside of an "O") to the start of the next (its
 *                         hole) is a long hop. Splitting on that hop recovers the
 *                         individual closed contours so the pen never draws the
 *                         bridging line.
 *   2. resampleContour  — re-spaces a contour into evenly spaced samples so a
 *                         normalised position maps to constant arc-length travel
 *                         (the pen moves at a steady speed regardless of how
 *                         densely textToPoints sampled that stretch), and so a
 *                         progress fraction is a plain array slice downstream.
 *   3. rotateContour    — rotates a closed contour's start index so the trace can
 *                         begin part-way round it (the "chaotic" start) instead
 *                         of always at textToPoints' first point.
 *
 * Everything operates on, and returns, plain `{ x, y }` objects; the engine in
 * `_shared.js` is the only place that turns them into draw calls.
 */

export function distance(
  a, b
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt( dx * dx + dy * dy );
}

/**
 * Split a flat, ordered point list into sub-contours wherever two consecutive
 * points are further apart than `breakDistance`. textToPoints walks each closed
 * outline in order and then hops to the next, so those hops are exactly the
 * contour boundaries. Empty input → no contours; a single run with no big hop →
 * one contour.
 */
export function splitContours(
  points, breakDistance
) {
  if ( !points || points.length === 0 ) {
    return [];
  }

  const contours = [];
  let current = [
    points[ 0 ]
  ];

  for ( let i = 1; i < points.length; i++ ) {
    if ( distance(
      points[ i - 1 ],
      points[ i ]
    ) > breakDistance ) {
      contours.push( current );
      current = [];
    }

    current.push( points[ i ] );
  }

  if ( current.length > 0 ) {
    contours.push( current );
  }

  return contours;
}

/**
 * Resample a contour into points spaced ~`spacing` apart along its arc length.
 * For a `closed` contour the wrap-around segment (last → first) is included in
 * the length budget but the duplicated closing point is dropped, so the result
 * is a clean ring of N points where index i sits at arc fraction i / N. For an
 * open contour both endpoints are kept and index i sits at i / ( N - 1 ).
 *
 * Constant spacing is what makes every downstream operation a simple index
 * slice: "draw up to fraction t" is `samples.slice( 0, round( t * N ) )`, and a
 * pen at fraction t is `samples[ round( t * N ) ]`, both at steady pen speed.
 */
export function resampleContour(
  points, spacing, closed = true
) {
  const n = points ? points.length : 0;

  if ( n === 0 ) {
    return [];
  }

  if ( n === 1 ) {
    return [
      {
        x: points[ 0 ].x,
        y: points[ 0 ].y
      }
    ];
  }

  const verts = closed
    ? points.concat( [
      points[ 0 ]
    ] )
    : points;

  const cum = [
    0
  ];

  for ( let i = 1; i < verts.length; i++ ) {
    cum.push( cum[ i - 1 ] + distance(
      verts[ i - 1 ],
      verts[ i ]
    ) );
  }

  const total = cum[ cum.length - 1 ];

  if ( total === 0 ) {
    return [
      {
        x: points[ 0 ].x,
        y: points[ 0 ].y
      }
    ];
  }

  const steps = Math.max(
    2,
    Math.round( total / Math.max(
      spacing,
      1e-6
    ) )
  );
  const out = [];
  let seg = 0;

  for ( let i = 0; i <= steps; i++ ) {
    const target = total * i / steps;

    while ( seg < cum.length - 2 && cum[ seg + 1 ] < target ) {
      seg++;
    }

    const segLength = cum[ seg + 1 ] - cum[ seg ] || 1;
    const t = ( target - cum[ seg ] ) / segLength;

    out.push( {
      x: verts[ seg ].x + ( verts[ seg + 1 ].x - verts[ seg ].x ) * t,
      y: verts[ seg ].y + ( verts[ seg + 1 ].y - verts[ seg ].y ) * t
    } );
  }

  // For a closed ring the last sample coincides with the first; drop it so the
  // consumer can wrap with a plain modulo instead of skipping a duplicate.
  if ( closed ) {
    out.pop();
  }

  return out;
}

/**
 * Rotate a closed contour so it starts `offsetFraction` of the way round it
 * (0 → unchanged, 0.5 → start halfway). Used for the "chaotic" reveal where each
 * outline begins at its own point instead of all starting at textToPoints' seam.
 */
export function rotateContour(
  samples, offsetFraction
) {
  const n = samples.length;

  if ( n < 2 || !offsetFraction ) {
    return samples.slice();
  }

  const k = ( ( Math.round( offsetFraction * n ) % n ) + n ) % n;

  if ( k === 0 ) {
    return samples.slice();
  }

  return samples.slice( k ).concat( samples.slice(
    0,
    k
  ) );
}

/**
 * Deterministic [0, 1) pseudo-random from an integer seed — a tiny hash so each
 * contour gets a stable "random" rotation that is identical every loop (a real
 * RNG would make the seamless loop jitter, and Math.random is unavailable in the
 * workflow sandbox the tests share).
 */
export function hashedRandom( seed ) {
  let h = ( seed ^ 0x9e3779b9 ) >>> 0;

  h = Math.imul(
    h ^ ( h >>> 16 ),
    0x45d9f3b
  ) >>> 0;
  h = Math.imul(
    h ^ ( h >>> 16 ),
    0x45d9f3b
  ) >>> 0;
  h = ( h ^ ( h >>> 16 ) ) >>> 0;

  return h / 4294967296;
}

/**
 * Shortest-arc interpolation between two angles. Plain lerp on raw radians jumps
 * by 2π when the two angles straddle ±π; this wraps the delta into [-π, π] first
 * so the result always takes the short way round (used to ease the heading across
 * a pen-lift, where the two contour ends point in unrelated directions).
 */
export function lerpAngle(
  a, b, t
) {
  let d = b - a;

  while ( d > Math.PI ) {
    d -= 2 * Math.PI;
  }
  while ( d < -Math.PI ) {
    d += 2 * Math.PI;
  }

  return a + d * t;
}

/**
 * Box-blur a series of angles `passes` times, keeping the two endpoints fixed.
 * The input is expected to be ALREADY UNWRAPPED (continuous, no ±π jumps) so a
 * plain average is meaningful — see `tangentHeadings`. A little smoothing rounds
 * the violent heading snap a glyph's sharp corners would otherwise produce when
 * the world is rotated to follow the pen.
 */
export function smoothAngles(
  values, passes = 1
) {
  const n = values.length;

  if ( n < 3 || passes < 1 ) {
    return Array.from( values );
  }

  let cur = Array.from( values );

  for ( let pass = 0; pass < passes; pass++ ) {
    const out = new Array( n );

    out[ 0 ] = cur[ 0 ];
    out[ n - 1 ] = cur[ n - 1 ];

    for ( let i = 1; i < n - 1; i++ ) {
      out[ i ] = ( cur[ i - 1 ] + cur[ i ] + cur[ i + 1 ] ) / 3;
    }

    cur = out;
  }

  return cur;
}

/**
 * The continuous heading (tangent angle) at every sample of a closed contour.
 *
 * Each entry is the direction of the segment leaving sample i (i → i+1, wrapping
 * at the seam), but instead of raw `atan2` values — which flip by 2π whenever the
 * tangent crosses ±π — the series is UNWRAPPED into one continuous run by adding
 * the minimal signed step each time. So as the pen walks a closed ring the
 * heading drifts smoothly by ~±2π over the loop (the winding), which is exactly
 * what lets the camera rotate the world to keep the trace pointing one way
 * without snapping. The result is then lightly smoothed (`smoothAngles`) to take
 * the edge off sharp corners. Pure geometry: translation-invariant, so it can be
 * computed after the word is centred.
 */
export function tangentHeadings(
  contour, smoothingPasses = 2
) {
  const n = contour ? contour.length : 0;

  if ( n === 0 ) {
    return [];
  }

  if ( n === 1 ) {
    return [
      0
    ];
  }

  const headings = new Array( n );
  let prev = Math.atan2(
    contour[ 1 % n ].y - contour[ 0 ].y,
    contour[ 1 % n ].x - contour[ 0 ].x
  );

  headings[ 0 ] = prev;
  let acc = prev;

  for ( let i = 1; i < n; i++ ) {
    const a = contour[ ( i + 1 ) % n ];
    const b = contour[ i ];
    const raw = Math.atan2(
      a.y - b.y,
      a.x - b.x
    );
    let delta = raw - prev;

    while ( delta > Math.PI ) {
      delta -= 2 * Math.PI;
    }
    while ( delta < -Math.PI ) {
      delta += 2 * Math.PI;
    }

    acc += delta;
    headings[ i ] = acc;
    prev = raw;
  }

  return smoothAngles(
    headings,
    smoothingPasses
  );
}

/**
 * Read the unwrapped heading at arc fraction `t` (0..1) of a contour, optionally
 * aiming `lookahead` samples further along so the camera anticipates a curve
 * before reaching it. Because `tangentHeadings` is continuous, neighbouring
 * entries are close and a plain lerp between them is safe (no ±π special-casing).
 */
export function sampleHeading(
  headings, t, lookahead = 0
) {
  const n = headings.length;

  if ( n === 0 ) {
    return 0;
  }

  if ( n === 1 ) {
    return headings[ 0 ];
  }

  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  let pos = clamped * ( n - 1 ) + lookahead;

  if ( pos < 0 ) {
    pos = 0;
  }
  if ( pos > n - 1 ) {
    pos = n - 1;
  }

  const i = Math.floor( pos );
  const frac = pos - i;
  const a = headings[ i ];
  const b = headings[ Math.min(
    i + 1,
    n - 1
  ) ];

  return a + ( b - a ) * frac;
}
