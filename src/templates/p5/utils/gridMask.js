import cache from "./cache.js";
import grid from "./grid.js";
import {
  getP5
} from "./sketch.js";

/**
 * gridMask — compute a per-cell alpha field from a set of mask points
 * (typically a letter outline from string.getTextPoints) over a grid.
 *
 * Replaces the duplicated `getAlphaFromMask` / `createGridAlphaPoints` helpers
 * that were copy-pasted across the 36days-of-type and animated-text-points
 * sketches.
 *
 * The field is computed ONCE per (grid, points, distance, mode) and cached, so
 * it is never recomputed per frame. For animated letters, only a change of
 * letter (i.e. a change of `signature`) triggers a rebuild.
 *
 * Performance: instead of the naive O(cells * points) reduction, points are
 * bucketed into a uniform spatial hash whose cell size equals `distance`. For
 * each grid cell only the 3x3 neighbouring buckets are scanned. This is
 * pixel-identical to the naive version: any point farther than `distance`
 * contributes the alpha floor (0 in falloff, `false` in boolean) to the `max`,
 * so ignoring it never changes the result — and a point within `distance` is
 * always within the 3x3 neighbourhood.
 */
const gridMask = {
  // Mirror grid.create's cache key so the mask field invalidates exactly when
  // the underlying grid geometry does.
  gridSignature: ( gridOptions ) => {
    const {
      topLeft, topRight, bottomLeft, bottomRight, rows, columns, diamond
    } = gridOptions;

    return cache.key(
      topLeft?.x,
      topRight?.x,
      bottomLeft?.x,
      bottomRight?.x,
      topLeft?.y,
      topRight?.y,
      bottomLeft?.y,
      bottomRight?.y,
      rows,
      columns,
      !!diamond
    );
  },

  field: async( {
    gridOptions,
    points,
    signature,
    distance,
    space = "pixel", // "pixel" | "normalized"
    output = "falloff", // "falloff" | "boolean"
    alphaRange = [
      0,
      255
    ],
    excludeZeroDistance = false
  } ) => {
    const p = getP5();
    const [
      lo,
      hi
    ] = alphaRange;

    const cacheKey = cache.key(
      "grid-mask",
      gridMask.gridSignature( gridOptions ),
      signature,
      distance,
      space,
      output,
      lo,
      hi,
      excludeZeroDistance
    );

    const cached = cache.get( cacheKey );

    if ( cached !== undefined ) {
      return cached;
    }

    const {
      cells
    } = await grid.create( gridOptions );

    // Normalised space maps x/y independently over width/height (anisotropic),
    // exactly like the original getAlphaFromMask implementations.
    const toMetric =
      space === "normalized"
        ? (
          x, y
        ) => [
          p.map(
            x,
            -p.width / 2,
            p.width / 2,
            0,
            1
          ),
          p.map(
            y,
            -p.height / 2,
            p.height / 2,
            0,
            1
          )
        ]
        : (
          x, y
        ) => [
          x,
          y
        ];

    // Normalise mask points ONCE (the previous code re-normalised every point
    // for every cell).
    const metricPoints = points.map( ( point ) => toMetric(
      point.x,
      point.y
    ) );

    // Uniform spatial hash, bucket size = distance.
    const buckets = new Map();
    const bucketKey = (
      bi, bj
    ) => bi + "," + bj;

    for ( let i = 0; i < metricPoints.length; i++ ) {
      const [
        mx,
        my
      ] = metricPoints[ i ];
      const key = bucketKey(
        Math.floor( mx / distance ),
        Math.floor( my / distance )
      );
      const bucket = buckets.get( key );

      if ( bucket ) {
        bucket.push( i );
      } else {
        buckets.set(
          key,
          [
            i
          ]
        );
      }
    }

    const distanceSquared = distance * distance;
    const alpha = new Float32Array( cells.length );
    const nonZero = [];

    for ( let k = 0; k < cells.length; k++ ) {
      const cell = cells[ k ];
      const [
        cx,
        cy
      ] = toMetric(
        cell.x,
        cell.y
      );
      const bi = Math.floor( cx / distance );
      const bj = Math.floor( cy / distance );

      let a = 0;

      for ( let di = -1; di <= 1 && a < hi; di++ ) {
        for ( let dj = -1; dj <= 1 && a < hi; dj++ ) {
          const bucket = buckets.get( bucketKey(
            bi + di,
            bj + dj
          ) );

          if ( !bucket ) {
            continue;
          }

          for ( let b = 0; b < bucket.length; b++ ) {
            const [
              mx,
              my
            ] = metricPoints[ bucket[ b ] ];
            const ddx = mx - cx;
            const ddy = my - cy;
            const d2 = ddx * ddx + ddy * ddy;

            // Points at or beyond `distance` contribute the alpha floor (0) to
            // the max, so they can be skipped without changing the result.
            if ( d2 >= distanceSquared ) {
              continue;
            }

            const d = Math.sqrt( d2 );

            if ( output === "boolean" ) {
              if ( !excludeZeroDistance || d > 0 ) {
                a = 1;
                break;
              }
            } else {
              const mapped = ~~p.map(
                d,
                0,
                distance,
                hi,
                lo,
                true
              );

              if ( mapped > a ) {
                a = mapped;
              }
            }
          }
        }
      }

      alpha[ k ] = a;

      if ( a ) {
        nonZero.push( k );
      }
    }

    const result = {
      cells,
      alpha,
      nonZero,
      columns: gridOptions.columns,
      rows: gridOptions.rows
    };

    cache.set(
      cacheKey,
      result
    );

    return result;
  },

  // Morph between two precomputed fields (same grid) without recomputing any
  // distance. `t` in [0, 1].
  lerpField: (
    fieldA, fieldB, t
  ) => {
    const a = fieldA.alpha;
    const b = fieldB.alpha;
    const out = new Float32Array( a.length );

    for ( let i = 0; i < a.length; i++ ) {
      out[ i ] = a[ i ] + ( b[ i ] - a[ i ] ) * t;
    }

    return out;
  }
};

export default gridMask;
