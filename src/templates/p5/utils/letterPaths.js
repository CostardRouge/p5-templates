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
