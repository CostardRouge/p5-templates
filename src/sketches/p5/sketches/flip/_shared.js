// ─────────────────────────────────────────────────────────────────────────────
// The flip family's beat, shared by every sketch in the category.
//
// One BEAT is a half turn: the plane goes from edge-on (-90°) through face-on
// (0°) to edge-on again (+90°), and the next beat restarts at -90° with the
// next thing to show. Both ends are the same plane seen edge-on, so the
// restart is invisible — and it is also what keeps the content readable rather
// than mirrored, which a naive continuous 180° would not (the back of a glyph
// is its mirror image).
//
// The edge-on frame is therefore the one frame where ANYTHING may change
// discontinuously — which letter is on stage, how many cells there are, what
// they are framed at — because there is nothing on screen to pop. Every sketch
// in this category is built on that single rule; see docs/memory/sketches.md.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overshoot curve (easeOutBack): the tile passes its resting angle and settles
 * back into it. That small bounce is what reads as a mechanical board rather
 * than an interpolation. Lands exactly on 0 and 1, so the loop still closes.
 *
 * @param {number} v normalised progress through one half turn, 0 → 1
 * @param {number} amount 0 = none, 1 = a pronounced bounce
 * @returns {number} the eased value, which may briefly exceed 1
 */
export function overshootCurve(
  v, amount
) {
  const c = 1.70158 * amount;

  return 1 + ( c + 1 ) * Math.pow(
    v - 1,
    3
  ) + c * Math.pow(
    v - 1,
    2
  );
}

/**
 * One beat, for a subject whose clock is `beats` (a fractional beat count).
 *
 * `turn` runs -1 → 0 → +1 across the beat (× 90° = the plane's angle), holding
 * at 0 for the middle `hold` fraction so the content stays legible. `fitU`
 * runs 0 → 1 over the FIRST half only: anything that has to travel between two
 * states (a camera distance, a size) should ride it, so it arrives by the time
 * the content is face-on and is already parked when the second half starts —
 * which is what keeps it continuous across the beat boundary.
 *
 * @param {number} beats the subject's own clock, already staggered/delayed
 * @param {number} hold fraction of the beat held face-on (0 = constant spin)
 * @param {function} easeFn easing applied to each half turn
 * @param {number} [overshoot=0] see overshootCurve
 * @returns {{ index: number, u: number, turn: number, fitU: number }}
 */
export function flipBeat(
  beats, hold, easeFn, overshoot = 0
) {
  const index = Math.floor( beats );
  const u = beats - index;
  const half = ( 1 - hold ) / 2;

  if ( half <= 1e-6 ) {
    return {
      index,
      u,
      turn: 0,
      fitU: 1
    };
  }

  const shape = ( v ) => {
    const base = easeFn( v );

    return overshoot > 0
      ? base + ( overshootCurve(
        v,
        overshoot
      ) - base ) * overshoot
      : base;
  };

  if ( u < half ) {
    const eased = shape( u / half );

    return {
      index,
      u,
      turn: eased - 1,
      fitU: easeFn( u / half )
    };
  }

  if ( u < half + hold ) {
    return {
      index,
      u,
      turn: 0,
      fitU: 1
    };
  }

  return {
    index,
    u,
    turn: shape( ( u - half - hold ) / half ),
    fitU: 1
  };
}

/**
 * Positive modulo. Beat indices run negative as soon as a stagger shifts a
 * subject back past frame 0, and every consumer indexes a cycle with them.
 */
export function mod(
  n, m
) {
  return ( ( n % m ) + m ) % m;
}

/**
 * Deterministic hash of two integers → [0, 1). Every random-looking choice in
 * this category goes through it rather than Math.random: a capture has to
 * reproduce the same chaos frame for frame, and the same one next week.
 */
export function hash2(
  a, b, seed
) {
  let h = ( Math.round( a ) * 374761393 + Math.round( b ) * 668265263 + Math.round( seed ) * 2246822519 ) | 0;

  h = ( h ^ ( h >>> 13 ) ) * 1274126177;

  return ( ( h ^ ( h >>> 16 ) ) >>> 0 ) / 4294967296;
}

/**
 * Value noise over the unit square, built from hash2 so it stays pure and
 * seedable — p5's own noise() carries a module-level seed that another sketch
 * layer can move under us.
 */
export function valueNoise(
  x, y, seed, frequency = 4
) {
  const fx = x * frequency;
  const fy = y * frequency;
  const xi = Math.floor( fx );
  const yi = Math.floor( fy );
  const smooth = ( t ) => t * t * ( 3 - 2 * t );
  const u = smooth( fx - xi );
  const v = smooth( fy - yi );
  const a = hash2(
    xi,
    yi,
    seed
  );
  const b = hash2(
    xi + 1,
    yi,
    seed
  );
  const c = hash2(
    xi,
    yi + 1,
    seed
  );
  const d = hash2(
    xi + 1,
    yi + 1,
    seed
  );

  return ( a + ( b - a ) * u ) * ( 1 - v ) + ( c + ( d - c ) * u ) * v;
}
