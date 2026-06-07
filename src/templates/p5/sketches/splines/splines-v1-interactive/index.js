import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  renderSpline
} from "../_shared.js";

// ── What this sketch demonstrates ──────────────────────────────────────────
// The same control-point-free splines as v0, but the points come from the live
// interaction layer instead of a procedural layout. Each detected entity (a
// hand, a body pose, or a virtual source like orbit) becomes ONE ordered group,
// and every group is drawn as its own spline.
//
// Two modes:
//   - live  → re-fit a spline through each group's current points every frame
//             (e.g. a fan across the fingertips, an arc across the body).
//   - trail → track each group's centroid over time and spline that history,
//             so moving a hand/pointer draws a ribbon in the air.
//
// It works with no webcam out of the box because the orbit source is enabled by
// default; turn on Vision → Hands (or Body) to drive it with the camera.

// Per-entity trail history for "trail" mode, keyed by group id so each hand /
// pose / source keeps its own ribbon.
const trails = new Map();

function centroid( points ) {
  const p = getP5();
  let sx = 0;
  let sy = 0;

  points.forEach( ( v ) => {
    sx += v.x;
    sy += v.y;
  } );

  return p.createVector(
    sx / points.length,
    sy / points.length
  );
}

// Append this frame's centroid to a group's history, throttled by distance so
// the ribbon doesn't pile up points while the entity is still, and capped to a
// maximum length so the tail fades away.
function pushTrailPoint(
  id, point, maxPoints, minDistance
) {
  let entry = trails.get( id );

  if ( !entry ) {
    entry = {
      points: []
    };
    trails.set(
      id,
      entry
    );
  }

  const last = entry.points[ entry.points.length - 1 ];

  if ( !last || Math.hypot(
    point.x - last.x,
    point.y - last.y
  ) > minDistance ) {
    entry.points.push( point );
  }

  if ( entry.points.length > maxPoints ) {
    entry.points.splice(
      0,
      entry.points.length - maxPoints
    );
  }
}

function drawLive(
  groups, render
) {
  groups.forEach( ( group ) => {
    if ( group.points.length >= 2 ) {
      render( group.points );
    }
  } );
}

function drawTrails(
  groups, mode, render
) {
  const maxPoints = mode.maxPoints ?? 90;
  const minDistance = mode.minDistance ?? 6;
  const present = new Set();

  // Grow the history of every entity present this frame.
  groups.forEach( ( group ) => {
    present.add( group.id );
    pushTrailPoint(
      group.id,
      centroid( group.points ),
      maxPoints,
      minDistance
    );
  } );

  // Render every ribbon; entities that disappeared retract from the tail until
  // empty so the trail gracefully shrinks away instead of vanishing instantly.
  for ( const [
    id,
    entry
  ] of trails ) {
    if ( !present.has( id ) ) {
      entry.points.shift();

      if ( entry.points.length === 0 ) {
        trails.delete( id );

        continue;
      }
    }

    if ( entry.points.length >= 2 ) {
      render( entry.points );
    }
  }
}

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};
  const mode = o.mode ?? {};
  const modeType = mode.type ?? "live";

  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  // Temporal smoothing lives in the mode block but is consumed by the
  // interaction layer, so fold it into the options it receives.
  const groups = getPointerGroups( {
    ...interaction,
    smoothing: mode.smoothing ?? 0
  } );

  const curve = o.curve ?? {};
  const stroke = o.stroke ?? {};

  if ( modeType === "trail" ) {
    // Trails are time-series ribbons, so the raw-polygon / point markers overlay
    // (which annotates the source points) is intentionally suppressed.
    const render = ( points ) => renderSpline(
      points,
      {
        curve,
        stroke,
        overlay: {
          polygon: {
            show: false
          },
          points: {
            show: false
          }
        }
      }
    );

    drawTrails(
      groups,
      mode,
      render
    );

    return;
  }

  const overlay = o.overlay ?? {};
  const render = ( points ) => renderSpline(
    points,
    {
      curve,
      stroke,
      overlay
    }
  );

  drawLive(
    groups,
    render
  );
} );
