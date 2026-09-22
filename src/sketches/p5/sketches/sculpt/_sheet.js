import {
  hash01,
  valueNoise3
} from "./_lattice.js";
import {
  windowMax
} from "./_extremes.js";

// ─────────────────────────────────────────────────────────────────────────────
// The sheet a "relief" sculpt runs on: a regular lattice of nodes in the plane,
// one height per node, and the dynamics that lift the heights under a presence
// and let them settle back.
//
// Unlike `_lattice.js` (a seeded scatter with k-nearest links, capped at 96 for
// a uniform array), the sheet is a GRID on purpose: a raymarcher can then find
// the cell a sample point falls in with a `floor` and evaluate only the links
// of the 3 × 3 cells around it, so the node count has no ceiling and a face or
// a body may lift a third of the sheet at once. Everything the shader needs per
// node travels in a small RGBA texture (`packSheet`).
//
// Units: x in cells (one column = 1), z in world units — a row is `rowScale`
// tall, 1 for a square lattice and √3 / 2 for a hexagonal one, so distances on
// the sheet stay isotropic. The height is a fraction 0 → 1 of the sketch's
// `lift.height`.
//
// Pure functions of their inputs: no p5, no Math.random (see the category rule
// in docs/memory/sketches.md). The generator skips `_`-prefixed files, so this
// module is not a sketch.
// ─────────────────────────────────────────────────────────────────────────────

export const LAYOUTS = [
  "square",
  "hex"
];
export const LIFT_ORDERS = [
  "instant",
  "radial",
  "sweep-x",
  "sweep-y",
  "noise"
];
export const LIFT_PROFILES = [
  "plateau",
  "dome",
  "rim"
];

export const MAX_COLUMNS = 64;
export const MAX_ROWS = 64;

// A hexagonal lattice is a square one with every other row shifted by half a
// column (± a quarter each way, so the shift is symmetric inside the jitter
// budget) and rows packed at √3 / 2, which makes all six neighbours 1 apart.
export const HEX_ROW_SCALE = Math.sqrt( 3 ) / 2;
export const HEX_OFFSET = 0.25;

// Kept between a node's furthest reach and its cell wall, so the shader's
// 3 × 3 neighbourhood is exhaustive (see `jitterBudget`).
const WALL_MARGIN = 0.02;

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

export function rowScaleFor( layout ) {
  return layout === "hex" ? HEX_ROW_SCALE : 1;
}

/**
 * How the sheet sits on the canvas: the columns span the width inside the
 * margin, and the row count follows from the canvas aspect so the cells stay
 * square whatever size the sketch is exported at.
 *
 * @param {object} cfg
 * @param {number} cfg.columns
 * @param {number} cfg.rowScale
 * @param {number} cfg.width   canvas px
 * @param {number} cfg.height  canvas px
 * @param {number} cfg.margin  fraction of the canvas kept clear on each side
 * @returns {{columns:number, rows:number, cellPx:number, rowScale:number, originX:number, originY:number, width:number, height:number}}
 */
export function sheetFrame( {
  columns,
  rowScale,
  width,
  height,
  margin
} ) {
  const cols = clamp(
    Math.round( columns ),
    2,
    MAX_COLUMNS
  );
  const m = clamp(
    margin ?? 0,
    0,
    0.4
  );
  const usableW = width * ( 1 - 2 * m );
  const usableH = height * ( 1 - 2 * m );
  const cellPx = usableW / ( cols - 1 );
  const rows = clamp(
    1 + Math.round( usableH / ( cellPx * rowScale ) ),
    2,
    MAX_ROWS
  );

  return {
    columns: cols,
    rows,
    cellPx,
    rowScale,
    originX: width * m,
    originY: ( height - ( rows - 1 ) * cellPx * rowScale ) / 2,
    width,
    height
  };
}

/** Canvas pixel → sheet world units (x in cells, z in world units). */
export function canvasToSheet(
  frame, x, y
) {
  return {
    x: ( x - frame.originX ) / frame.cellPx,
    z: ( y - frame.originY ) / frame.cellPx
  };
}

/** Sheet world units → canvas pixel. */
export function sheetToCanvas(
  frame, x, z
) {
  return {
    x: frame.originX + x * frame.cellPx,
    y: frame.originY + z * frame.cellPx
  };
}

/**
 * How far a node may leave its cell centre, per axis, so that a link's tube
 * never reaches into a cell two away: the shader evaluates the 3 × 3 cells
 * around a sample, and a node jittered to its wall with a fat tube on it would
 * otherwise intrude unseen. The budget is what is left of half a cell once the
 * hex parity shift and the widest tube are taken.
 *
 * @param {object} cfg
 * @param {string} cfg.layout
 * @param {number} cfg.jitter     asked-for jitter, cells
 * @param {number} cfg.maxRadius  widest tube or bead, cells
 * @returns {{x:number, z:number}} world units
 */
export function jitterBudget( {
  layout,
  jitter,
  maxRadius
} ) {
  const rowScale = rowScaleFor( layout );
  const parity = layout === "hex" ? HEX_OFFSET : 0;
  const asked = Math.max(
    jitter ?? 0,
    0
  );

  return {
    x: clamp(
      Math.min(
        asked,
        0.5 - parity - maxRadius - WALL_MARGIN
      ),
      0,
      0.5
    ),
    z: clamp(
      Math.min(
        asked,
        0.5 * rowScale - maxRadius - WALL_MARGIN
      ),
      0,
      0.5
    )
  };
}

/**
 * Build the sheet: rest positions per node, the seeded jitter already applied.
 *
 * @param {object} cfg
 * @param {number} cfg.columns
 * @param {number} cfg.rows
 * @param {string} cfg.layout  "square" | "hex"
 * @param {number} cfg.jitter  cells
 * @param {number} cfg.seed
 * @param {number} cfg.maxRadius  widest tube or bead, cells (bounds the jitter)
 */
export function buildSheet( {
  columns,
  rows,
  layout = "square",
  jitter = 0,
  seed = 0,
  maxRadius = 0
} ) {
  const cols = clamp(
    Math.round( columns ),
    2,
    MAX_COLUMNS
  );
  const rowCount = clamp(
    Math.round( rows ),
    2,
    MAX_ROWS
  );
  const rowScale = rowScaleFor( layout );
  const budget = jitterBudget( {
    layout,
    jitter,
    maxRadius
  } );
  const parity = layout === "hex" ? HEX_OFFSET : 0;
  const n = cols * rowCount;
  const px = new Float32Array( n );
  const pz = new Float32Array( n );
  const jx = new Float32Array( n );
  const jz = new Float32Array( n );

  for ( let j = 0; j < rowCount; j++ ) {
    const shift = j % 2 === 1 ? parity : -parity;

    for ( let i = 0; i < cols; i++ ) {
      const k = j * cols + i;
      const ox = shift + ( hash01(
        seed,
        i,
        j,
        41
      ) * 2 - 1 ) * budget.x;
      const oz = ( hash01(
        seed,
        i,
        j,
        43
      ) * 2 - 1 ) * budget.z;

      jx[ k ] = ox;
      jz[ k ] = oz / rowScale;
      px[ k ] = i + ox;
      pz[ k ] = j * rowScale + oz;
    }
  }

  return {
    key: [
      cols,
      rowCount,
      layout,
      jitter,
      seed,
      maxRadius
    ].join( "|" ),
    columns: cols,
    rows: rowCount,
    layout,
    rowScale,
    budget,
    px,
    pz,
    jx,
    jz
  };
}

// Memoised on the parameters, like getLattice: several layers with the same
// settings share one sheet.
const sheetMemo = new Map();
const SHEET_MEMO_MAX = 8;

export function getSheet( cfg ) {
  const key = [
    cfg.columns,
    cfg.rows,
    cfg.layout,
    cfg.jitter,
    cfg.seed,
    cfg.maxRadius
  ].join( "|" );
  const cached = sheetMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const sheet = buildSheet( cfg );

  sheetMemo.set(
    key,
    sheet
  );

  if ( sheetMemo.size > SHEET_MEMO_MAX ) {
    sheetMemo.delete( sheetMemo.keys().next().value );
  }

  return sheet;
}

/**
 * A loop-closing drift of the rest positions: seeded value noise sampled on a
 * circle in noise space whose angle is the loop clock, so whole `cycles`
 * return exactly. Amplitude in cells, per axis, bounded by the caller.
 *
 * @returns {number[]} [dx, dz] world units
 */
export function sheetDriftAt(
  i, j, loop, {
    amplitude,
    cycles,
    scale,
    seed
  }
) {
  if ( !( amplitude > 0 ) ) {
    return [
      0,
      0
    ];
  }

  const turns = Math.max(
    1,
    Math.round( cycles ?? 1 )
  );
  const a = loop * Math.PI * 2 * turns;
  const cx = Math.cos( a ) * 0.8;
  const cy = Math.sin( a ) * 0.8;
  const f = Math.max(
    scale ?? 0.25,
    0.01
  );

  return [
    ( valueNoise3(
      i * f + cx,
      j * f + cy,
      0.37,
      seed
    ) * 2 - 1 ) * amplitude,
    ( valueNoise3(
      i * f + cx + 19.1,
      j * f + cy + 7.3,
      0.71,
      seed
    ) * 2 - 1 ) * amplitude
  ];
}

// ── Heights ──────────────────────────────────────────────────────────────────

/** Per-node dynamic state for a sheet of `n` nodes. */
export function createHeightState( n ) {
  return {
    heights: new Float32Array( n ),
    targets: new Float32Array( n ),
    presence: new Float32Array( n ),
    hold: new Float32Array( n ),
    age: new Float32Array( n )
  };
}

/**
 * Fraction of the remaining distance covered in `dt` when the move takes
 * `seconds` to reach 95%: framerate-independent, and instantaneous at 0.
 */
export function rateFor(
  dt, seconds
) {
  if ( !( seconds > 0 ) ) {
    return 1;
  }

  return 1 - Math.exp( -3 * dt / seconds );
}

/**
 * Where a node sits in the order its silhouette lifts, 0 (first) → 1 (last).
 * `entity` is the silhouette's footprint on the sheet: centre, radius, bbox.
 *
 * @param {string} order one of LIFT_ORDERS
 * @param {number} x world x
 * @param {number} z world z
 * @param {{cx:number, cz:number, radius:number, minX:number, maxX:number, minZ:number, maxZ:number}|null} entity
 * @param {number} [seed=0]
 */
export function liftRank(
  order, x, z, entity, seed = 0
) {
  if ( !entity ) {
    return 0;
  }

  switch ( order ) {
    case "radial":
      return clamp(
        Math.hypot(
          x - entity.cx,
          z - entity.cz
        ) / Math.max(
          entity.radius,
          1e-6
        ),
        0,
        1
      );
    case "sweep-x":
      return clamp(
        ( x - entity.minX ) / Math.max(
          entity.maxX - entity.minX,
          1e-6
        ),
        0,
        1
      );
    case "sweep-y":
      return clamp(
        ( z - entity.minZ ) / Math.max(
          entity.maxZ - entity.minZ,
          1e-6
        ),
        0,
        1
      );
    case "noise":
      return valueNoise3(
        x * 0.35 + 3.1,
        z * 0.35 + 8.7,
        0.5,
        seed
      );
    default:
      return 0;
  }
}

/**
 * Turn this frame's presence into a target height per node: a node under a
 * presence ages, and only lifts once it has aged past its rank's share of
 * `stagger` (seconds) — that is what makes a silhouette rise from its centre
 * outward, or sweep, instead of popping up whole.
 *
 * @param {ReturnType<typeof createHeightState>} st
 * @param {Float32Array} ranks 0 → 1 per node (see liftRank)
 * @param {number} dt seconds
 * @param {number} stagger seconds between the first and the last rank
 */
export function computeTargets(
  st, ranks, dt, stagger
) {
  const {
    presence,
    age,
    targets
  } = st;

  for ( let i = 0; i < targets.length; i++ ) {
    const pres = presence[ i ];

    if ( pres > 0 ) {
      age[ i ] += dt;
      targets[ i ] = age[ i ] >= ranks[ i ] * stagger ? pres : 0;
    } else {
      age[ i ] = 0;
      targets[ i ] = 0;
    }
  }

  return targets;
}

/**
 * Contagion: a lifted node pulls its neighbours within `radius` cells up to
 * `gain` × its own target, fading linearly so a neighbour at `radius` still
 * gets 1 / (radius + 1) of the gain. Keeps a plateau from reading as a
 * staircase and lets a thin finger widen into a ridge. Writes `out`.
 */
export function spreadTargets(
  sheet, targets, out, radius, gain
) {
  if ( !( radius > 0 ) || !( gain > 0 ) ) {
    out.set( targets );

    return out;
  }

  const {
    columns,
    rows,
    rowScale
  } = sheet;
  const reach = Math.ceil( radius );

  for ( let j = 0; j < rows; j++ ) {
    for ( let i = 0; i < columns; i++ ) {
      const k = j * columns + i;
      let best = targets[ k ];

      for ( let dj = -reach; dj <= reach; dj++ ) {
        const jj = j + dj;

        if ( jj < 0 || jj >= rows ) {
          continue;
        }

        for ( let di = -reach; di <= reach; di++ ) {
          const ii = i + di;

          if ( ( di === 0 && dj === 0 ) || ii < 0 || ii >= columns ) {
            continue;
          }

          const d = Math.hypot(
            di,
            dj * rowScale
          );

          if ( d > radius ) {
            continue;
          }

          const v = targets[ jj * columns + ii ] * gain * ( 1 - d / ( radius + 1 ) );

          if ( v > best ) {
            best = v;
          }
        }
      }

      out[ k ] = best;
    }
  }

  return out;
}

/**
 * Advance the heights toward their targets. Rising and falling have their own
 * time-to-95% in seconds; a node whose target dropped holds its height for
 * `hold` seconds before it starts to fall.
 *
 * @param {ReturnType<typeof createHeightState>} st
 * @param {number} dt seconds
 * @param {{rise:number, fall:number, hold:number}} cfg
 */
export function integrateHeights(
  st, dt, {
    rise,
    fall,
    hold
  }
) {
  const {
    heights,
    targets
  } = st;
  const holdLeft = st.hold;
  const riseRate = rateFor(
    dt,
    rise
  );
  const fallRate = rateFor(
    dt,
    fall
  );

  for ( let i = 0; i < heights.length; i++ ) {
    const t = targets[ i ];
    let h = heights[ i ];

    if ( t > h ) {
      holdLeft[ i ] = hold;
      h += ( t - h ) * riseRate;
    } else if ( t < h ) {
      if ( holdLeft[ i ] > 0 ) {
        holdLeft[ i ] -= dt;
      } else {
        h += ( t - h ) * fallRate;
      }
    }

    heights[ i ] = h < 1e-4 && t === 0 ? 0 : h;
  }

  return heights;
}

// ── The texture the shader reads ─────────────────────────────────────────────
// One RGBA byte quad per node: the height on 16 bits (R high, G low — 8 bits
// visibly steps a slow rise), the x jitter in B and the z jitter (row units)
// in A, both offset by 0.5. `drift` (world units, optional) is added to the
// jitter so a drifting sheet needs no second texture.

/**
 * @param {ReturnType<typeof buildSheet>} sheet
 * @param {Float32Array} heights 0 → 1 per node
 * @param {Uint8Array} out columns × rows × 4 bytes
 * @param {Float32Array|null} [driftX] per-node world x offset, or null
 * @param {Float32Array|null} [driftZ] per-node world z offset, or null
 */
export function packSheet(
  sheet, heights, out, driftX = null, driftZ = null
) {
  const {
    jx,
    jz,
    rowScale
  } = sheet;

  for ( let k = 0; k < heights.length; k++ ) {
    const v = Math.round( clamp(
      heights[ k ],
      0,
      1
    ) * 65535 );
    const ox = jx[ k ] + ( driftX ? driftX[ k ] : 0 );
    const oz = jz[ k ] + ( driftZ ? driftZ[ k ] / rowScale : 0 );
    const o = k * 4;

    out[ o ] = v >> 8;
    out[ o + 1 ] = v & 255;
    out[ o + 2 ] = Math.round( clamp(
      ox + 0.5,
      0,
      1
    ) * 255 );
    out[ o + 3 ] = Math.round( clamp(
      oz + 0.5,
      0,
      1
    ) * 255 );
  }

  return out;
}

/** The height a packed quad decodes to (the shader's arithmetic, for tests). */
export function unpackHeight(
  packed, k
) {
  return ( packed[ k * 4 ] * 256 + packed[ k * 4 + 1 ] ) / 65535;
}

// Scratch for packTops' window pass, sized on first use per sheet.
let topsScratch = null;

/**
 * Pack, per node, the highest height within `reach` cells, as one byte
 * rounded UP: the shader reads it as a ceiling over its 3 × 3 scan block
 * (whose links end within two cells of the sample) and drops a ray straight
 * to it instead of stepping a cell at a time through empty air. Heights are
 * clamped to 0 → 1 like packSheet, so the ceiling covers the drawn height.
 *
 * @param {ReturnType<typeof buildSheet>} sheet
 * @param {Float32Array} heights 0 → 1 per node
 * @param {Uint8Array} out columns × rows bytes (a luminance texture)
 * @param {number} [reach=2] cells each way
 * @returns {{ max: number }} the clamped highest height on the sheet
 */
export function packTops(
  sheet, heights, out, reach = 2
) {
  const {
    columns,
    rows
  } = sheet;
  const n = columns * rows;

  if ( !topsScratch || topsScratch.length !== n ) {
    topsScratch = new Float32Array( n );
  }

  const tops = windowMax(
    heights,
    columns,
    rows,
    reach,
    topsScratch
  );
  let max = 0;

  for ( let k = 0; k < n; k++ ) {
    const top = clamp(
      tops[ k ],
      0,
      1
    );

    out[ k ] = Math.ceil( top * 255 );

    if ( top > max ) {
      max = top;
    }
  }

  return {
    max
  };
}

/** Whether both ends of a link (or either, `any`) clear the threshold. */
export function linkGate(
  ha, hb, threshold, require
) {
  const gate = require === "any" ? Math.max(
    ha,
    hb
  ) : Math.min(
    ha,
    hb
  );

  return gate >= threshold;
}
