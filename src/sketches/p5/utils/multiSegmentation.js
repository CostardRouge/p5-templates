import mediapipe, {
  interact
} from "./mediapipe/mediapipe.js";

// ── Multi-point interactive segmentation ────────────────────────────────────
// Manages several focus points on one photo for MediaPipe's interactive
// segmenter. The segmenter answers one point at a time (a single result
// slot), so the manager runs one inference per point sequentially, caches
// each point's raw category mask, and exposes the union of every mask as
// the combined subject. Used by photo-segmentation-v1-mask and the
// photo-trail-effect sketches, which share the click-to-pick /
// click-a-marker-to-unpick interaction.

// An in-flight request that never lands (dropped message, worker restart)
// is retried after this long.
const IN_FLIGHT_TIMEOUT_MS = 4000;

function pointKey( pt ) {
  return `${ pt.x.toFixed( 5 ) },${ pt.y.toFixed( 5 ) }`;
}

/**
 * @param {object} [config]
 * @param {boolean} [config.adoptLatest=false] - Attribute a result whose
 *   focus point was replaced while its inference ran to the next point still
 *   missing a mask, instead of discarding it. Single-point sketches that
 *   re-pick faster than the segmenter answers (the v2 noise walk) want this:
 *   it reproduces the pre-manager racing semantics where the latest landed
 *   result was always shown. Multi-point sketches must keep it off — an
 *   unpicked zone's mask must never be attributed to another point.
 */
export function createMultiMaskSegmenter( {
  adoptLatest = false
} = {} ) {
  const state = {
    // Focus points, normalized (0-1) image space.
    points: [],
    // pointKey → raw mask {data, width, height} from the segmenter.
    masks: new Map(),
    imagePath: null,
    inFlightKey: null,
    inFlightAt: 0,
    lastResultAt: null,
    // Bumped whenever the mask set changes, so callers can cheaply detect
    // that the combined subject needs a rebuild.
    version: 0,
    combinedCache: null
  };

  return {
    get points() {
      return state.points;
    },

    get version() {
      return state.version;
    },

    get maskCount() {
      return state.masks.size;
    },

    reset() {
      state.points = [];
      state.masks.clear();
      state.imagePath = null;
      state.inFlightKey = null;
      state.inFlightAt = 0;
      state.lastResultAt = null;
      state.version++;
      state.combinedCache = null;
    },

    // A new photo invalidates every cached mask (they belong to the old
    // pixels).
    setImage( path ) {
      if ( path === state.imagePath ) {
        return;
      }

      state.imagePath = path;
      state.masks.clear();
      state.inFlightKey = null;
      state.version++;
    },

    // Adopt the working point list. Masks of removed points are pruned;
    // points without a mask get segmented by the next update() calls.
    setPoints( points ) {
      state.points = points.map( ( pt ) => ( {
        x: pt.x,
        y: pt.y
      } ) );

      const keys = new Set( state.points.map( pointKey ) );
      let changed = false;

      for ( const key of [
        ...state.masks.keys()
      ] ) {
        if ( !keys.has( key ) ) {
          state.masks.delete( key );
          changed = true;
        }
      }

      if ( state.inFlightKey && !keys.has( state.inFlightKey ) ) {
        state.inFlightKey = null;
      }

      if ( changed ) {
        state.version++;
      }
    },

    // Per-frame pump: adopt a landed inference, then fire the next missing
    // one. Strictly one at a time — the interactive task has a single
    // result slot, so a second request would clobber the first.
    update( photo ) {
      const result = mediapipe.tasks.interactive;

      if ( result?.result && result.updatedAt !== state.lastResultAt ) {
        state.lastResultAt = result.updatedAt;

        // The point may have been unpicked while its inference ran; with
        // adoptLatest the orphaned result goes to the next maskless point
        // (old racing semantics), otherwise it is discarded.
        let targetKey =
          state.inFlightKey &&
          state.points.some( ( pt ) => pointKey( pt ) === state.inFlightKey )
            ? state.inFlightKey
            : null;

        if ( !targetKey && adoptLatest ) {
          const orphanTarget = state.points.find( ( pt ) => !state.masks.has( pointKey( pt ) ) );

          targetKey = orphanTarget ? pointKey( orphanTarget ) : null;
        }

        if ( state.inFlightKey || adoptLatest ) {
          if ( targetKey ) {
            state.masks.set(
              targetKey,
              result.result
            );
            state.version++;
          }

          state.inFlightKey = null;
        }
      }

      if (
        state.inFlightKey &&
        performance.now() - state.inFlightAt > IN_FLIGHT_TIMEOUT_MS
      ) {
        state.inFlightKey = null;
      }

      if (
        state.inFlightKey ||
        !photo?.img?.width ||
        !mediapipe.processor.ready ||
        mediapipe.processor.busy
      ) {
        return;
      }

      const next = state.points.find( ( pt ) => !state.masks.has( pointKey( pt ) ) );

      if ( !next ) {
        return;
      }

      state.inFlightKey = pointKey( next );
      state.inFlightAt = performance.now();

      const imageElement = photo.img.canvas || photo.img.elt || photo.img;

      interact(
        next.x * photo.img.width,
        next.y * photo.img.height,
        imageElement
      );
    },

    // Union of every cached mask: data[i] = 1 where any mask marks the
    // pixel as subject. `inverse` mirrors the sketches' checkbox (with it
    // on, the model's category mask marks the clicked object with 0).
    // Cached until the mask set or the flag changes.
    combined( inverse ) {
      if ( state.masks.size === 0 ) {
        return null;
      }

      const cache = state.combinedCache;

      if ( cache && cache.version === state.version && cache.inverse === inverse ) {
        return cache;
      }

      let width = 0;
      let height = 0;
      let out = null;

      state.masks.forEach( ( raw ) => {
        if ( !raw?.data ) {
          return;
        }

        if ( !out ) {
          width = raw.width;
          height = raw.height;
          out = new Uint8Array( width * height );
        }

        // A mask with other dimensions is stale (previous photo) — skip it.
        if ( raw.width !== width || raw.height !== height ) {
          return;
        }

        const data = raw.data;
        const length = Math.min(
          data.length,
          out.length
        );

        for ( let i = 0; i < length; i++ ) {
          if ( inverse ? data[ i ] === 0 : data[ i ] > 0 ) {
            out[ i ] = 1;
          }
        }
      } );

      if ( !out ) {
        return null;
      }

      state.combinedCache = {
        version: state.version,
        inverse,
        data: out,
        width,
        height
      };

      return state.combinedCache;
    }
  };
}

// ── Focus-marker UI ─────────────────────────────────────────────────────────
// The circles drawn on every picked point carry a small "minus" line: the
// affordance that clicking the circle unpicks that zone.

/**
 * Index of the focus point whose marker contains the canvas-space `point`,
 * or -1. `rect` is the photo rectangle on the canvas ({x, y, w, h}).
 */
export function hitFocusMarker(
  points, rect, point, radius
) {
  if ( !rect || rect.w <= 0 || rect.h <= 0 ) {
    return -1;
  }

  for ( let i = 0; i < points.length; i++ ) {
    const cx = rect.x + points[ i ].x * rect.w;
    const cy = rect.y + points[ i ].y * rect.h;

    if ( Math.hypot(
      point.x - cx,
      point.y - cy
    ) <= radius ) {
      return i;
    }
  }

  return -1;
}

/**
 * Draw one circle + minus per focus point. `cfg` mirrors the sketches'
 * marker option block ({ color, radius, weight }).
 */
export function drawFocusMarkers(
  p, points, rect, cfg
) {
  if ( !rect || rect.w <= 0 || rect.h <= 0 || points.length === 0 ) {
    return;
  }

  const radius = cfg.radius ?? 16;
  const weight = cfg.weight ?? 3;
  const color = cfg.color ?? [
    255
  ];

  p.push();
  p.noFill();
  p.stroke( ...color );
  p.strokeWeight( weight );

  points.forEach( ( pt ) => {
    const cx = rect.x + pt.x * rect.w;
    const cy = rect.y + pt.y * rect.h;

    p.circle(
      cx,
      cy,
      radius * 2
    );

    // The "minus" inside the circle: click here to unpick this zone.
    p.line(
      cx - radius * 0.45,
      cy,
      cx + radius * 0.45,
      cy
    );
  } );

  p.pop();
}
