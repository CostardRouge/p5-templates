// ─────────────────────────────────────────────────────────────────────────────
// Window extremes over a row-major grid: for every cell, the max (or min) of
// the values in the (2 × reach + 1)² block around it, clipped at the edges.
//
// This is what lets a grid sculpt's raymarcher skip the empty air above (and
// below) a resting sheet: the shader scans a fixed block of cells around a
// sample, so everything it can trace has its endpoints within `reach` cells,
// and "the highest point within `reach` cells, plus the widest radius" is a
// ceiling a ray above it can drop to in one cheap step instead of crawling
// down one cell at a time through the full scan (see the sketch headers).
//
// Separable: a horizontal pass into a scratch row, then a vertical pass, so
// the cost is O(count × reach) rather than O(count × reach²). Pure functions;
// shared by `_mesh.js` and `_sheet.js`, which must not import each other.
// ─────────────────────────────────────────────────────────────────────────────

const scratchByLength = new Map();
const SCRATCH_MAX = 4;

// One scratch buffer per grid size, reused every frame; a handful of sizes at
// most (one per live sketch layer), so nothing here grows.
function scratchFor( length ) {
  let scratch = scratchByLength.get( length );

  if ( !scratch ) {
    if ( scratchByLength.size >= SCRATCH_MAX ) {
      scratchByLength.delete( scratchByLength.keys().next().value );
    }

    scratch = new Float32Array( length );
    scratchByLength.set(
      length,
      scratch
    );
  }

  return scratch;
}

function windowExtreme(
  values, cols, rows, reach, out, pick
) {
  const r = Math.max(
    0,
    Math.round( reach )
  );
  const scratch = scratchFor( cols * rows );

  // Along each row: the extreme over i - r … i + r.
  for ( let j = 0; j < rows; j++ ) {
    const base = j * cols;

    for ( let i = 0; i < cols; i++ ) {
      const lo = Math.max(
        0,
        i - r
      );
      const hi = Math.min(
        cols - 1,
        i + r
      );
      let best = values[ base + lo ];

      for ( let ii = lo + 1; ii <= hi; ii++ ) {
        best = pick(
          best,
          values[ base + ii ]
        );
      }

      scratch[ base + i ] = best;
    }
  }

  // Then down each column of the row extremes: j - r … j + r.
  for ( let j = 0; j < rows; j++ ) {
    const lo = Math.max(
      0,
      j - r
    );
    const hi = Math.min(
      rows - 1,
      j + r
    );

    for ( let i = 0; i < cols; i++ ) {
      let best = scratch[ lo * cols + i ];

      for ( let jj = lo + 1; jj <= hi; jj++ ) {
        best = pick(
          best,
          scratch[ jj * cols + i ]
        );
      }

      out[ j * cols + i ] = best;
    }
  }

  return out;
}

/**
 * The max over the (2 × reach + 1)² block around every cell.
 *
 * @param {ArrayLike<number>} values row-major, cols × rows
 * @param {number} cols
 * @param {number} rows
 * @param {number} reach cells each way (2 = a 5 × 5 block)
 * @param {Float32Array} out cols × rows
 * @returns {Float32Array} out
 */
export function windowMax(
  values, cols, rows, reach, out
) {
  return windowExtreme(
    values,
    cols,
    rows,
    reach,
    out,
    Math.max
  );
}

/**
 * The min over the (2 × reach + 1)² block around every cell.
 *
 * @param {ArrayLike<number>} values row-major, cols × rows
 * @param {number} cols
 * @param {number} rows
 * @param {number} reach cells each way (2 = a 5 × 5 block)
 * @param {Float32Array} out cols × rows
 * @returns {Float32Array} out
 */
export function windowMin(
  values, cols, rows, reach, out
) {
  return windowExtreme(
    values,
    cols,
    rows,
    reach,
    out,
    Math.min
  );
}
