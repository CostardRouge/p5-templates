import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";
import {
  renderSplines
} from "../_shared.js";

// ── What this sketch demonstrates ──────────────────────────────────────────
// The same control-point-free splines as v0, but the points come from the live
// interaction layer instead of a procedural layout. Each detected entity (a
// hand, a body pose, a face, or a virtual source like orbit) becomes ONE ordered
// group, and every group is drawn as its own spline.
//
// Two modes:
//   - live  → re-fit a spline through each group's current points every frame
//             (e.g. a fan across the fingertips, an arc across the body, or —
//             with Vision → Fingers — one spline along each finger's joints).
//   - trail → track each group's anchor over time and spline that history,
//             so moving a hand/pointer draws a ribbon in the air. Most groups
//             anchor at their centroid; finger groups anchor at the FINGERTIP,
//             so each finger acts as a pen and traces its own line.
//
// It works with no webcam out of the box because the orbit source is enabled by
// default; turn on Vision → Hands / Body / Face to drive it with the camera.

// Per-entity trail history for "trail" / "recall" modes, keyed by group id so
// each hand / pose / source keeps its own ribbon.
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

// One ordered point list per live entity, so every spline in the frame can be
// drawn in a single batched pass. Multi-point flat sources (orbit, perlinNoise,
// audio, …) now arrive as one group per point — great for trail/recall mode
// where each point gets its own ribbon, but useless on its own for a LIVE
// spline (a single point can't form a curve). Re-aggregate same-source
// singletons here so the source still draws as one connected polyline in live
// mode, matching the prior look while keeping trail/recall split per-point.
function collectLive( groups ) {
  const lists = [];
  const singletonsBySource = new Map();

  groups.forEach( ( group ) => {
    if ( group.points.length >= 2 ) {
      lists.push( group.points );

      return;
    }

    if ( group.points.length === 1 ) {
      const accumulator = singletonsBySource.get( group.source ) ?? [];

      accumulator.push( group.points[ 0 ] );
      singletonsBySource.set(
        group.source,
        accumulator
      );
    }
  } );

  for ( const points of singletonsBySource.values() ) {
    if ( points.length >= 2 ) {
      lists.push( points );
    }
  }

  return lists;
}

function collectTrails(
  groups, mode, behaviour = "trail", pullSpeed = 0
) {
  const maxPoints = mode.maxPoints ?? 90;
  const minDistance = mode.minDistance ?? 6;
  const present = new Set();

  // Grow the history of every entity present this frame. Finger groups are
  // ordered base → tip, so their last point is the fingertip — the natural
  // pen point — while other groups trail their centroid.
  groups.forEach( ( group ) => {
    present.add( group.id );

    const anchor = group.source === "fingers"
      ? group.points[ group.points.length - 1 ]
      : centroid( group.points );

    const entry = trails.get( group.id );

    // Both `recall` and `chase` retract the existing trail toward the live
    // anchor each frame; what differs is how the points get there.
    //
    //   recall → every point lerps directly at `pullSpeed` toward the anchor,
    //            so the whole tail collapses along the straight line between
    //            it and the anchor.
    //   chase  → every point lerps toward its SUCCESSOR (the newer neighbour),
    //            and the newest point lerps toward the anchor — so the chain
    //            collapses by following the path that earlier points carved.
    //
    // Both branches mutate the existing vectors in place instead of replacing
    // them with new ones, because the per-frame allocation churn ( N points ×
    // M entities × hundreds of frames ) was triggering enough GC to slow the
    // sketch down by itself in long recall sessions.
    if ( entry && entry.points.length > 0 && pullSpeed > 0 ) {
      const points = entry.points;
      const n = points.length;

      if ( behaviour === "chase" ) {
        // Older first: each point's new target is the NEWER neighbour BEFORE
        // we mutate it, so the chain shifts smoothly along the recorded path
        // instead of compressing in a single frame.
        for ( let i = 0; i < n - 1; i++ ) {
          const target = points[ i + 1 ];

          points[ i ].x += ( target.x - points[ i ].x ) * pullSpeed;
          points[ i ].y += ( target.y - points[ i ].y ) * pullSpeed;
        }

        const head = points[ n - 1 ];

        head.x += ( anchor.x - head.x ) * pullSpeed;
        head.y += ( anchor.y - head.y ) * pullSpeed;
      } else {
        // recall: straight pull toward the anchor.
        for ( let i = 0; i < n; i++ ) {
          const pt = points[ i ];

          pt.x += ( anchor.x - pt.x ) * pullSpeed;
          pt.y += ( anchor.y - pt.y ) * pullSpeed;
        }
      }
    }

    pushTrailPoint(
      group.id,
      anchor,
      maxPoints,
      minDistance
    );
  } );

  // Collect every ribbon; entities that disappeared retract from the tail until
  // empty so the trail gracefully shrinks away instead of vanishing instantly.
  const lists = [];

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

    lists.push( entry.points );
  }

  return lists;
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

  p.clear();
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
  const rawStroke = o.stroke ?? {};

  // Loop-exact clock: renderSplines' hue scroll multiplies animation.angle by
  // hueSpeed directly (splines/_shared.js), which only returns to its start hue
  // when hueSpeed is a WHOLE number of cycles per loop — snapped here at the
  // call site since _shared.js is shared with other families.
  const stroke = {
    ...rawStroke,
    hueSpeed: Math.round( rawStroke.hueSpeed ?? 1 )
  };

  if ( modeType === "trail" || modeType === "recall" || modeType === "chase" ) {
    // Trails are time-series ribbons, so the raw-polygon / point markers overlay
    // (which annotates the source points) is intentionally suppressed. `recall`
    // and `chase` are `trail` with non-zero pull-back factors — recall pulls
    // every point straight toward the anchor (collapses along the line),
    // chase makes each point follow its newer neighbour (collapses along the
    // recorded path). Same renderer, same overlay rules.
    let behaviour = "trail";
    let pullSpeed = 0;

    if ( modeType === "recall" ) {
      behaviour = "recall";
      pullSpeed = mode.recallSpeed ?? 0.08;
    } else if ( modeType === "chase" ) {
      behaviour = "chase";
      pullSpeed = mode.chaseSpeed ?? 0.12;
    }

    renderSplines(
      collectTrails(
        groups,
        mode,
        behaviour,
        pullSpeed
      ),
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
  } else {
    const overlay = o.overlay ?? {};

    renderSplines(
      collectLive( groups ),
      {
        curve,
        stroke,
        overlay
      }
    );
  }

  // The shared debug overlay (crosshairs, pointer markers, finger chains,
  // camera preview, legend) is drawn LAST so it stacks on top of the splines.
  // Every piece is gated by the form's Interaction → Visualization and
  // Vision → Camera options, so it only shows up when the user asks for it.
  drawInteractionOverlay( interaction );
} );
