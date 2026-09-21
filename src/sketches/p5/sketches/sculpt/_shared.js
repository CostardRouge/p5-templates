// ─────────────────────────────────────────────────────────────────────────────
// The sculpt category's logic, shared by every sketch in it.
//
// A sculpt sketch is a field of points joined by tubes, and something — a
// letter, a wave, a hand — decides which points rise. Everything that decides
// lives here, in plain JavaScript over typed arrays, with no p5 and no GL:
//
//   • the field of points (a jittered grid, a seed, a drift on the loop clock),
//   • the ORDER in which a set of points rises (reading, sweep, radial, spiral,
//     contour, noise, random) — a value in 0..1 per point,
//   • the ENVELOPE turning a beat's progress into a height per point (rise,
//     hold, fall, and how one beat hands over to the next),
//   • the LINKS between neighbouring points, with the rule that keeps a letter
//     readable (a link exists only where its midpoint is in the ink),
//   • the PACKING of all that into RGBA8 data textures the shader reads.
//
// The shader only ever reads the textures: it finds the cell under a sample
// point, scans the 3×3 around it, and sphere-traces beads and capsules. Every
// frame is a pure function of the loop progression, so headless capture
// renders the same frames as the preview — the one exception is a cursor,
// which is absent in capture by construction.
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

// Offsets are stored in cell units. A point never leaves the middle 90 % of
// its own cell: the shader's wall clamp and its 3×3 scan are exact only while
// every point stays inside the cell that owns it (see the sketch header).
export const MAX_OFFSET = 0.45;

// Normalised heights live in this range: `press` pushes a point below the
// sheet, easeOutBack overshoots above 1. Packed to 16 bits over the range.
export const HEIGHT_MIN = -0.5;
export const HEIGHT_MAX = 1.5;

// Link weights are packed to one byte: 0 = no link at all, 1..255 = a link
// carrying a weight in 0..WEIGHT_MAX (weight 0 is the rest mesh).
export const WEIGHT_MAX = 1.5;

// The four links a cell OWNS, in texture channel order (r, g, b, a): east,
// south, south-east, south-west. Every link of the grid is owned by exactly
// one cell, so each is stored — and traced — once.
export const LINK_DIRS = [
  [
    1,
    0
  ],
  [
    0,
    1
  ],
  [
    1,
    1
  ],
  [
    -1,
    1
  ]
];

// `reach` 4 keeps the orthogonal links, 8 adds the diagonals.
export function linkCountForReach( reach ) {
  return Number( reach ) === 4 ? 2 : 4;
}

/**
 * Deterministic [0, 1) from two integers and a seed — the same hash everywhere
 * in the category, so a seed reproduces a field across sketches and sessions.
 */
export function hash01(
  i, j, seed
) {
  let h = ( Math.imul(
    i | 0,
    374761393
  ) + Math.imul(
    j | 0,
    668265263
  ) + Math.imul(
    seed | 0,
    1013904223
  ) ) | 0;

  h = Math.imul(
    h ^ ( h >>> 13 ),
    1274126177
  );
  h = ( h ^ ( h >>> 16 ) ) >>> 0;

  return h / 4294967296;
}

/** Smooth 2D value noise in [0, 1], seeded, with no p5 dependency. */
export function valueNoise2(
  x, y, seed
) {
  const xi = Math.floor( x );
  const yi = Math.floor( y );
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * ( 3 - 2 * fx );
  const sy = fy * fy * ( 3 - 2 * fy );
  const a = hash01(
    xi,
    yi,
    seed
  );
  const b = hash01(
    xi + 1,
    yi,
    seed
  );
  const c = hash01(
    xi,
    yi + 1,
    seed
  );
  const d = hash01(
    xi + 1,
    yi + 1,
    seed
  );
  const top = a + ( b - a ) * sx;
  const bottom = c + ( d - c ) * sx;

  return top + ( bottom - top ) * sy;
}

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

/**
 * The field of points: `cols` across, rows following the aspect, each point
 * at its cell centre plus a seeded jitter. `layout: "hex"` shifts odd rows by
 * half a cell (the links stay the grid's — a hex field is a topology, not a
 * different neighbourhood).
 *
 * `u` / `v` are the RESTING normalised positions (0..1 across the sheet, v
 * down), `jx` / `jz` the static jitter in cell units. Per-frame offsets
 * (drift, cursor) are added on top by the caller.
 *
 * @returns {{ cols, rows, count, u: Float32Array, v: Float32Array,
 *   jx: Float32Array, jz: Float32Array }}
 */
export function buildGrid( {
  cols,
  aspect = 1,
  jitter = 0.3,
  seed = 7,
  layout = "grid"
} ) {
  const c = Math.max(
    4,
    Math.round( cols )
  );
  const rows = Math.max(
    3,
    Math.round( c / Math.max(
      aspect,
      1e-3
    ) )
  );
  const count = c * rows;
  const u = new Float32Array( count );
  const v = new Float32Array( count );
  const jx = new Float32Array( count );
  const jz = new Float32Array( count );
  const amount = clamp(
    jitter,
    0,
    MAX_OFFSET * 2
  );

  for ( let j = 0; j < rows; j++ ) {
    const hexShift = layout === "hex" && ( j % 2 === 1 ) ? 0.5 : 0;

    for ( let i = 0; i < c; i++ ) {
      const n = j * c + i;
      const ox = clamp(
        hexShift + ( hash01(
          i,
          j,
          seed
        ) - 0.5 ) * amount,
        -MAX_OFFSET,
        MAX_OFFSET
      );
      const oz = clamp(
        ( hash01(
          i,
          j,
          seed + 31
        ) - 0.5 ) * amount,
        -MAX_OFFSET,
        MAX_OFFSET
      );

      jx[ n ] = ox;
      jz[ n ] = oz;
      u[ n ] = ( i + 0.5 + ox ) / c;
      v[ n ] = ( j + 0.5 + oz ) / rows;
    }
  }

  return {
    cols: c,
    rows,
    count,
    u,
    v,
    jx,
    jz
  };
}

/**
 * Per-frame drift of the whole field, written into `outX` / `outZ` (cell
 * units, jitter included). The noise field is sampled along a circle of the
 * loop progression — `cycles` whole turns — so progression 0 and 1 read the
 * same offsets and the loop closes; spatially it is one coherent field, so
 * neighbours move together and the mesh flows rather than boils.
 */
export function driftOffsets(
  grid, {
    amount = 0,
    scale = 2,
    cycles = 1,
    seed = 7,
    progression = 0
  }, outX, outZ
) {
  const {
    count,
    u,
    v,
    jx,
    jz
  } = grid;

  if ( amount <= 0 ) {
    outX.set( jx );
    outZ.set( jz );

    return;
  }

  const turns = Math.max(
    1,
    Math.round( cycles )
  );
  const phase = progression * turns * TAU;
  const cx = Math.cos( phase ) * 1.7;
  const cy = Math.sin( phase ) * 1.7;

  for ( let n = 0; n < count; n++ ) {
    const x = u[ n ] * scale + cx;
    const y = v[ n ] * scale + cy;
    const nx = valueNoise2(
      x,
      y,
      seed + 101
    ) * 2 - 1;
    const nz = valueNoise2(
      x + 37.3,
      y + 11.9,
      seed + 211
    ) * 2 - 1;

    outX[ n ] = clamp(
      jx[ n ] + nx * amount,
      -MAX_OFFSET,
      MAX_OFFSET
    );
    outZ[ n ] = clamp(
      jz[ n ] + nz * amount,
      -MAX_OFFSET,
      MAX_OFFSET
    );
  }
}

export const ORDER_MODES = [
  "reading",
  "sweep",
  "radial-out",
  "radial-in",
  "spiral",
  "contour-in",
  "contour-out",
  "noise",
  "random"
];

/**
 * The order in which the raised points of one unit rise: a value in 0..1 per
 * point (0 first), normalised over the points whose target is > 0 and left at
 * 0 elsewhere. `contour` modes read `edge` (0 at the outline, 1 deep inside;
 * the mask's ring fraction, see the sketch) so the outline can lead or follow.
 *
 * @param {object} grid       buildGrid result
 * @param {Float32Array} target per-point target height of the unit
 * @param {object} opts
 * @param {string} opts.mode  one of ORDER_MODES
 * @param {number} [opts.angle=0] sweep direction, radians (0 = left → right)
 * @param {number} [opts.seed=7]
 * @param {number} [opts.aspect=1]
 * @param {Float32Array} [opts.edge] per-point depth inside the ink, 0..1
 * @returns {Float32Array}
 */
export function orderValues(
  grid, target, {
    mode = "radial-out",
    angle = 0,
    seed = 7,
    aspect = 1,
    edge = null
  } = {}
) {
  const {
    count,
    u,
    v
  } = grid;
  const order = new Float32Array( count );

  // Centroid and radius of the raised set.
  let cx = 0;
  let cy = 0;
  let raised = 0;

  for ( let n = 0; n < count; n++ ) {
    if ( target[ n ] > 0 ) {
      cx += u[ n ];
      cy += v[ n ];
      raised++;
    }
  }

  if ( raised === 0 ) {
    return order;
  }

  cx /= raised;
  cy /= raised;

  let maxDist = 1e-6;

  for ( let n = 0; n < count; n++ ) {
    if ( target[ n ] > 0 ) {
      maxDist = Math.max(
        maxDist,
        Math.hypot(
          ( u[ n ] - cx ) * aspect,
          v[ n ] - cy
        )
      );
    }
  }

  const dirX = Math.cos( angle );
  const dirY = Math.sin( angle );
  let min = Infinity;
  let max = -Infinity;

  for ( let n = 0; n < count; n++ ) {
    if ( target[ n ] <= 0 ) {
      continue;
    }

    const dx = ( u[ n ] - cx ) * aspect;
    const dy = v[ n ] - cy;
    const dist = Math.hypot(
      dx,
      dy
    ) / maxDist;
    let value;

    switch ( mode ) {
      case "reading":
        value = ( u[ n ] + 0.25 * v[ n ] ) / 1.25;
        break;
      case "sweep":
        value = ( u[ n ] - 0.5 ) * aspect * dirX + ( v[ n ] - 0.5 ) * dirY;
        break;
      case "radial-in":
        value = 1 - dist;
        break;
      case "spiral":
        value = ( ( Math.atan2(
          dy,
          dx
        ) / TAU + 0.5 ) + dist * 1.5 ) % 1;
        break;
      case "contour-in":
        value = edge ? edge[ n ] : dist;
        break;
      case "contour-out":
        value = edge ? 1 - edge[ n ] : 1 - dist;
        break;
      case "noise":
        value = valueNoise2(
          u[ n ] * 3 * aspect,
          v[ n ] * 3,
          seed + 7
        );
        break;
      case "random":
        value = hash01(
          n,
          17,
          seed
        );
        break;
      default:
        value = dist;
    }

    order[ n ] = value;
    min = Math.min(
      min,
      value
    );
    max = Math.max(
      max,
      value
    );
  }

  const span = max - min || 1;

  for ( let n = 0; n < count; n++ ) {
    if ( target[ n ] > 0 ) {
      order[ n ] = ( order[ n ] - min ) / span;
    }
  }

  return order;
}

// A point's own progress through a staggered rise: with `spread` 0 every
// point moves with the beat, with `spread` → 1 the points go one after the
// other in `order`. Clamped to 0..1, so a point past its window sits at 1.
function stagger(
  q, order, spread
) {
  const s = Math.min(
    spread,
    0.95
  );

  return clamp(
    ( q - order * s ) / ( 1 - s ),
    0,
    1
  );
}

export const TRANSITIONS = [
  "sequential",
  "crossfade",
  "morph"
];

/**
 * The height of every point at beat time `tBeats` (whole beats = units).
 *
 * A beat holds its unit fully up for `hold` of its length, then hands over to
 * the next unit during the rest:
 *   • sequential — the unit falls completely, then the next rises,
 *   • crossfade  — both move at once, a point takes the higher of the two,
 *   • morph      — a point in BOTH units stays up and slides between the two
 *                  heights; only the difference falls and rises.
 * Rise and fall each have an order, a spread and an easing. `fall.mirror`
 * reverses the rise order for the fall, so what rose last falls first.
 *
 * Pure in `tBeats`: the same time gives the same heights, and `tBeats` equal
 * to the unit count wraps to 0, which is what closes the loop.
 *
 * @param {Array<{ target: Float32Array, order: Float32Array }>} units
 * @param {number} tBeats
 * @param {object} rhythm
 * @param {number} rhythm.hold        0..0.95, fraction of a beat held up
 * @param {string} rhythm.transition  one of TRANSITIONS
 * @param {{ spread: number, ease: Function }} rhythm.rise
 * @param {{ spread: number, ease: Function, mirror: boolean, order?: Float32Array[] }} rhythm.fall
 *   `fall.order`, when given, is one array per unit (a fall order of its own);
 *   otherwise the fall reuses the rise order, mirrored if asked.
 * @param {Float32Array} out
 * @returns {{ current: number, next: number, q: number }} which units are on
 *   stage and how far the handover is (0 = holding)
 */
export function computeHeights(
  units, tBeats, rhythm, out
) {
  const count = units.length;
  const hold = clamp(
    rhythm.hold ?? 0.4,
    0,
    0.95
  );
  const b = ( ( tBeats % count ) + count ) % count;
  const current = Math.floor( b );
  const next = ( current + 1 ) % count;
  const p = b - current;
  const q = p < hold ? 0 : ( p - hold ) / ( 1 - hold );
  const a = units[ current ];
  const n = units[ next ];
  const riseEase = rhythm.rise?.ease ?? ( ( x ) => x );
  const fallEase = rhythm.fall?.ease ?? ( ( x ) => x );
  const riseSpread = rhythm.rise?.spread ?? 0.6;
  const fallSpread = rhythm.fall?.spread ?? riseSpread;
  const mirror = rhythm.fall?.mirror !== false;
  const fallOrder = rhythm.fall?.order?.[ current ] ?? null;
  const transition = rhythm.transition ?? "morph";

  if ( q <= 0 ) {
    out.set( a.target );

    return {
      current,
      next,
      q
    };
  }

  for ( let i = 0; i < out.length; i++ ) {
    const ha = a.target[ i ];
    const hb = n.target[ i ];
    const oa = fallOrder
      ? fallOrder[ i ]
      : ( mirror ? 1 - a.order[ i ] : a.order[ i ] );
    const ob = n.order[ i ];
    let value;

    if ( transition === "sequential" ) {
      value = q < 0.5
        ? ha * ( 1 - fallEase( stagger(
          q * 2,
          oa,
          fallSpread
        ) ) )
        : hb * riseEase( stagger(
          ( q - 0.5 ) * 2,
          ob,
          riseSpread
        ) );
    } else if ( transition === "morph" && ha > 0 && hb > 0 ) {
      value = ha + ( hb - ha ) * q;
    } else {
      value = Math.max(
        ha * ( 1 - fallEase( stagger(
          q,
          oa,
          fallSpread
        ) ) ),
        hb * riseEase( stagger(
          q,
          ob,
          riseSpread
        ) )
      );
    }

    out[ i ] = value;
  }

  return {
    current,
    next,
    q
  };
}

/**
 * How much each point is under a set of cursors, 0..1 (the strongest wins):
 * `falloff` shapes the well from its centre (1) to its rim (0).
 *
 * @param {object} grid
 * @param {Float32Array} offX   current offsets (cell units), for the live positions
 * @param {Float32Array} offZ
 * @param {Array<{ u: number, v: number }>} cursors  sheet coordinates, 0..1
 * @param {number} radius       reach, as a fraction of the sheet height
 * @param {Function} falloff    easing 0..1 → 0..1
 * @param {number} aspect
 * @param {Float32Array} out
 */
export function cursorField(
  grid, offX, offZ, cursors, radius, falloff, aspect, out
) {
  const {
    count,
    cols,
    rows
  } = grid;

  out.fill( 0 );

  if ( !cursors.length || radius <= 0 ) {
    return;
  }

  for ( let n = 0; n < count; n++ ) {
    const i = n % cols;
    const j = ( n - i ) / cols;
    const u = ( i + 0.5 + offX[ n ] ) / cols;
    const v = ( j + 0.5 + offZ[ n ] ) / rows;
    let best = 0;

    for ( let c = 0; c < cursors.length; c++ ) {
      const d = Math.hypot(
        ( u - cursors[ c ].u ) * aspect,
        v - cursors[ c ].v
      ) / radius;

      if ( d < 1 ) {
        best = Math.max(
          best,
          falloff( 1 - d )
        );
      }
    }

    out[ n ] = best;
  }
}

/**
 * The links: one byte per owned direction per cell (E, S, SE, SW), 0 for no
 * link, else 1 + weight. A link's weight is min( hA, hB ) — the lower of its
 * two ends, so a link from a raised point down to the sheet stays a thin
 * skirt — and it is zeroed by the readability rule: with `rule: "ink"`, a
 * link between two raised points exists only if `inkAt( u, v )` says its
 * midpoint is on the ink. That single test is what keeps the counter of an
 * "o" or the eye of an "e" open, whatever the neighbourhood. A link longer
 * than `maxLength` cells (drift, cursor) is dropped entirely.
 *
 * @param {object} grid
 * @param {Float32Array} heights   normalised, HEIGHT_MIN..HEIGHT_MAX
 * @param {Float32Array} offX      cell units
 * @param {Float32Array} offZ
 * @param {object} opts
 * @param {number|string} opts.reach   4 or 8
 * @param {string} opts.rule           "ink" | "endpoints"
 * @param {number} [opts.maxLength=1.8] cells
 * @param {Function} [opts.inkAt]      ( u, v ) → 0 | 1, required for "ink"
 * @param {Uint8Array} out             count * 4 bytes
 */
export function linkWeights(
  grid, heights, offX, offZ, {
    reach = 8,
    rule = "ink",
    maxLength = 1.8,
    inkAt = null
  }, out
) {
  const {
    cols,
    rows,
    count
  } = grid;
  const dirs = linkCountForReach( reach );
  const useInk = rule === "ink" && typeof inkAt === "function";
  const maxLen2 = maxLength * maxLength;

  out.fill( 0 );

  for ( let n = 0; n < count; n++ ) {
    const i = n % cols;
    const j = ( n - i ) / cols;
    const ha = Math.max(
      0,
      heights[ n ]
    );

    for ( let d = 0; d < dirs; d++ ) {
      const ii = i + LINK_DIRS[ d ][ 0 ];
      const jj = j + LINK_DIRS[ d ][ 1 ];

      if ( ii < 0 || ii >= cols || jj >= rows ) {
        continue;
      }

      const m = jj * cols + ii;

      // Length in cells, offsets included (rows and columns share a cell
      // unit here; the aspect only stretches the cell, not the rule).
      const lx = LINK_DIRS[ d ][ 0 ] + offX[ m ] - offX[ n ];
      const lz = LINK_DIRS[ d ][ 1 ] + offZ[ m ] - offZ[ n ];

      if ( lx * lx + lz * lz > maxLen2 ) {
        continue;
      }

      let weight = Math.min(
        ha,
        Math.max(
          0,
          heights[ m ]
        )
      );

      if ( weight > 0 && useInk ) {
        const mu = ( i + ii + 1 + offX[ n ] + offX[ m ] ) / ( 2 * cols );
        const mv = ( j + jj + 1 + offZ[ n ] + offZ[ m ] ) / ( 2 * rows );

        if ( !inkAt(
          mu,
          mv
        ) ) {
          weight = 0;
        }
      }

      out[ n * 4 + d ] = 1 + Math.round( clamp(
        weight / WEIGHT_MAX,
        0,
        1
      ) * 254 );
    }
  }
}

/**
 * Pack the field into the shader's RGBA8 texel per cell: x / z offsets over
 * -1..1 cell, then the height over HEIGHT_MIN..HEIGHT_MAX as a 16-bit pair
 * (high byte, low byte). One byte of height would step by ~0.6 % of the
 * relief — visible on a slow morph — so it gets two.
 *
 * @param {object} grid
 * @param {Float32Array} offX
 * @param {Float32Array} offZ
 * @param {Float32Array} heights
 * @param {Uint8Array} out  count * 4 bytes
 */
export function packField(
  grid, offX, offZ, heights, out
) {
  const range = HEIGHT_MAX - HEIGHT_MIN;

  for ( let n = 0; n < grid.count; n++ ) {
    const q = Math.round( clamp(
      ( heights[ n ] - HEIGHT_MIN ) / range,
      0,
      1
    ) * 65535 );

    out[ n * 4 ] = Math.round( ( clamp(
      offX[ n ],
      -1,
      1
    ) + 1 ) * 127.5 );
    out[ n * 4 + 1 ] = Math.round( ( clamp(
      offZ[ n ],
      -1,
      1
    ) + 1 ) * 127.5 );
    out[ n * 4 + 2 ] = q >> 8;
    out[ n * 4 + 3 ] = q & 255;
  }
}

/** The inverse of packField's height, for tests and probes. */
export function unpackHeight(
  hi, lo
) {
  return HEIGHT_MIN + ( ( hi * 256 + lo ) / 65535 ) * ( HEIGHT_MAX - HEIGHT_MIN );
}

/**
 * Split the text into the units that take the stage one beat each: a letter
 * at a time (a space is a rest — an empty unit, everything down), a word at a
 * time, or the whole text at once.
 */
export function textUnits(
  text, group = "letter"
) {
  const value = ( text ?? "" ).toString();

  if ( group === "all" ) {
    return value.trim() ? [
      value.trim()
    ] : [
      ""
    ];
  }

  if ( group === "word" ) {
    const words = value.split( /\s+/ ).filter( Boolean );

    return words.length ? words : [
      ""
    ];
  }

  const letters = Array.from( value ).map( ( ch ) => ( ch.trim() === "" ? "" : ch ) );

  return letters.length ? letters : [
    ""
  ];
}
