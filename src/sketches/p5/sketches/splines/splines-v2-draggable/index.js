import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  createDraggable
} from "@/p5/utils/interaction/draggable.js";
import {
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import {
  renderSplines
} from "../_shared.js";

// ── What this sketch demonstrates ──────────────────────────────────────────
// The same control-point-free splines as v0, but the points are an editable,
// persisted list you can drag around. Three things make that work:
//
//   1. The points are stored NORMALIZED (0..1) in options.sketch.points.items,
//      so they survive canvas resizes and are saved/exported with the template.
//      Random by default (seeded); `count`/`seed` regenerate the layout.
//   2. The grab → move → release state machine, pointer collection (mouse +
//      touch) and the keep-off-the-viewport-pan affordance all come from the
//      shared draggable layer (utils/interaction/draggable.js) — the same
//      helper that makes the template content items draggable.
//   3. On top of the built-in mouse/touch pointers, the sketch feeds the
//      draggable layer camera pointers: enable Vision → Hands and the
//      thumb+index midpoint is the pointer, a PINCH (the two tips closer than
//      the threshold) is "pressed" — so you literally pinch a point and move
//      it. Every pointer is independent, so several can drag at once:
//      multi-touch (one point per finger) and multi-hand (one point per
//      pinching hand).

const state = sketch.state( () => ( {
  // Working copy of the control points, normalized [0..1].
  points: [],
  // `${count}|${seed}` signature: a change means "regenerate the layout".
  signature: null,
  // JSON of the items we last took from / wrote to the store, so we can tell an
  // external edit (form, reload) apart from our own drag write.
  syncHash: null,
  // Per-hand camera feedback for drawing: handId → { thumb, index, mid, pinching }.
  cameras: new Map(),
  // Per-hand EMA-smoothed pinch midpoint (camera landmarks are jittery), kept
  // separate so mouse/touch stay perfectly crisp.
  cameraSmooth: new Map(),
  // Per-hand pinch latch (hysteresis) so a borderline gap doesn't flicker.
  pinching: new Map()
} ) );

// Shared grab → move → release drag layer (mouse + touch built in, camera
// pointers fed per frame).
const draggable = createDraggable();

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

// Seeded random layout in normalized space (size-independent on purpose).
function generatePoints(
  count, seed
) {
  const p = getP5();
  const margin = 0.12;

  p.randomSeed( seed | 0 );

  const items = [];

  for ( let i = 0; i < count; i++ ) {
    items.push( {
      x: p.random(
        margin,
        1 - margin
      ),
      y: p.random(
        margin,
        1 - margin
      )
    } );
  }

  return items;
}

// Adopt a list coming from the store (form edit / reload / our own write) as the
// working copy, without writing back.
function adoptPoints( items ) {
  state.points = items.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );
  state.syncHash = JSON.stringify( items );
}

// Persist the working copy into the saved options so it survives reloads and is
// exported with the template. Slide-aware, mirroring photo-zoom-point: a
// per-slide sketch override wins when the deck is on a slide. Origin "p5" so the
// options module skips its own change handler (no feedback loop), while React
// still picks the new values up.
function persistPoints() {
  const items = state.points.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );

  state.syncHash = JSON.stringify( items );

  const p = getP5();
  const slideIndex = p?.getCurrentSlide?.()?.index;

  if (
    typeof slideIndex === "number" &&
    Array.isArray( options.slides ) &&
    options.slides[ slideIndex ]
  ) {
    const nextSlides = options.slides.map( (
      slide, index
    ) =>
      index === slideIndex
        ? {
          ...slide,
          sketch: {
            ...( slide?.sketch ?? {} ),
            points: {
              ...( slide?.sketch?.points ?? {} ),
              items
            }
          }
        }
        : slide );

    setSketchOptions(
      {
        slides: nextSlides
      },
      "p5"
    );

    return;
  }

  // deepMerge preserves the sibling keys (count, seed), so only items is sent.
  setSketchOptions(
    {
      sketch: {
        points: {
          items
        }
      }
    },
    "p5"
  );
}

function regeneratePoints(
  count, seed
) {
  const items = generatePoints(
    count,
    seed
  );

  adoptPoints( items );
  persistPoints();
}

// Reconcile the working copy with the stored options each frame (skipped while a
// drag is in flight so the grabbed point isn't snapped back to a stale value).
//   - seed/count changed → regenerate the random layout.
//   - first sync / invalid list → adopt if usable, otherwise regenerate.
//   - external edit (hash differs) → adopt.
function syncPoints( cfg ) {
  const count = Math.max(
    3,
    Math.round( cfg.count ?? 9 )
  );
  const seed = cfg.seed ?? 3;
  const signature = `${ count }|${ seed }`;
  const items = Array.isArray( cfg.items ) ? cfg.items : [];
  const valid = items.length === count && items.every( isPoint );

  if ( state.signature === null ) {
    if ( valid ) {
      adoptPoints( items );
    } else {
      regeneratePoints(
        count,
        seed
      );
    }

    state.signature = signature;

    return;
  }

  if ( signature !== state.signature ) {
    regeneratePoints(
      count,
      seed
    );
    state.signature = signature;

    return;
  }

  if ( !valid ) {
    regeneratePoints(
      count,
      seed
    );

    return;
  }

  if ( JSON.stringify( items ) !== state.syncHash ) {
    adoptPoints( items );
  }
}

function drawHighlight(
  p, pointsPx, hovers, grabbed, baseSize
) {
  p.push();
  p.noFill();

  hovers.forEach( ( index ) => {
    if ( grabbed.has( index ) ) {
      return;
    }

    p.stroke(
      255,
      255,
      255,
      170
    );
    p.strokeWeight( 2 );
    p.circle(
      pointsPx[ index ].x,
      pointsPx[ index ].y,
      baseSize * 1.8 + 10
    );
  } );

  grabbed.forEach( ( index ) => {
    p.stroke(
      120,
      200,
      255,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      pointsPx[ index ].x,
      pointsPx[ index ].y,
      baseSize * 2.1 + 12
    );
  } );

  p.pop();
}

// One hand's thumb + index pinch. The hands group is ordered
// [palm?, thumb, index, middle, ring, pinky], so the fingertips are the trailing
// five: thumb = points[len-5], index = points[len-4] (works with or without the
// palm landmark). The pointer is their midpoint, EMA-smoothed PER HAND; pressed
// is true while the tips are closer than `grab.pinch`, with a wider release
// threshold (hysteresis). All per-hand state is keyed by the stable group id, so
// two hands track independently.
function resolveHandPinch(
  group, o
) {
  const points = group.points;

  if ( points.length < 5 ) {
    return null;
  }

  const id = group.id;
  const thumb = points[ points.length - 5 ];
  const index = points[ points.length - 4 ];
  const rawMidX = ( thumb.x + index.x ) / 2;
  const rawMidY = ( thumb.y + index.y ) / 2;
  const lag = Math.min(
    0.95,
    Math.max(
      0,
      o.grab?.cameraSmoothing ?? 0.4
    )
  );

  let smooth = state.cameraSmooth.get( id );

  if ( !smooth ) {
    smooth = {
      x: rawMidX,
      y: rawMidY
    };
    state.cameraSmooth.set(
      id,
      smooth
    );
  }

  smooth.x += ( rawMidX - smooth.x ) * ( 1 - lag );
  smooth.y += ( rawMidY - smooth.y ) * ( 1 - lag );

  const distance = Math.hypot(
    thumb.x - index.x,
    thumb.y - index.y
  );
  const pinchOn = o.grab?.pinch ?? 70;
  const pinching = state.pinching.get( id )
    ? distance < pinchOn * 1.6
    : distance < pinchOn;

  state.pinching.set(
    id,
    pinching
  );
  state.cameras.set(
    id,
    {
      thumb,
      index,
      mid: {
        x: smooth.x,
        y: smooth.y
      },
      pinching
    }
  );

  return {
    mid: {
      x: smooth.x,
      y: smooth.y
    },
    pinching
  };
}

// Camera pointers for the draggable layer, one per tracked hand: pinch midpoint
// as position, "pinching" as pressed. Stale per-hand state for hands that left
// is pruned here.
function collectCameraPointers(
  o, groups
) {
  const pointers = [];
  const vision = o.interaction?.vision;

  if ( vision?.enabled && vision.hands?.enabled ) {
    const handGroups = groups.filter( ( group ) => group.source === "hands" );
    const present = new Set( handGroups.map( ( group ) => group.id ) );

    // Forget hands that left so their smoothing / latch / feedback don't linger.
    for ( const id of [
      ...state.cameras.keys()
    ] ) {
      if ( !present.has( id ) ) {
        state.cameras.delete( id );
        state.cameraSmooth.delete( id );
        state.pinching.delete( id );
      }
    }

    handGroups.forEach( ( group ) => {
      const pinch = resolveHandPinch(
        group,
        o
      );

      if ( pinch ) {
        pointers.push( {
          key: `cam-${ group.id }`,
          x: pinch.mid.x,
          y: pinch.mid.y,
          pressed: pinch.pinching,
          kind: "camera"
        } );
      }
    } );
  } else {
    state.cameras.clear();
    state.cameraSmooth.clear();
    state.pinching.clear();
  }

  return pointers;
}

// Thumb + index markers and the connector for EVERY tracked hand, accented while
// pinching, so the user can see what the camera tracks and when a grab triggers.
function drawCameraFeedback( p ) {
  if ( state.cameras.size === 0 ) {
    return;
  }

  p.push();

  state.cameras.forEach( ( camera ) => {
    const color = camera.pinching ? [
      120,
      200,
      255
    ] : [
      255,
      255,
      255
    ];

    p.stroke(
      ...color,
      camera.pinching ? 230 : 120
    );
    p.strokeWeight( camera.pinching ? 4 : 2 );
    p.line(
      camera.thumb.x,
      camera.thumb.y,
      camera.index.x,
      camera.index.y
    );

    p.noStroke();
    p.fill(
      ...color,
      220
    );
    p.circle(
      camera.thumb.x,
      camera.thumb.y,
      16
    );
    p.circle(
      camera.index.x,
      camera.index.y,
      16
    );
    p.fill(
      ...color,
      camera.pinching ? 255 : 120
    );
    p.circle(
      camera.mid.x,
      camera.mid.y,
      camera.pinching ? 14 : 8
    );
  } );

  p.pop();
}

sketch.setup( async() => {
  state.points = [];
  state.signature = null;
  state.syncHash = null;
  state.cameras = new Map();
  state.cameraSmooth = new Map();
  state.pinching = new Map();

  // Re-arm the drag layer's listeners (the engine's event registry is cleared
  // on reset).
  draggable.attach();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const cfg = o.points ?? {};
  const interaction = o.interaction ?? {};
  const grabRadius = o.grab?.radius ?? 44;

  // Re-sync from the store only when nothing is being dragged, so a live drag is
  // never snapped back to a stale value.
  if ( !draggable.dragging ) {
    syncPoints( cfg );
  }

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );
  p.strokeCap( p.ROUND );
  p.strokeJoin( p.ROUND );

  const pointsPx = state.points.map( ( n ) => p.createVector(
    n.x * p.width,
    n.y * p.height
  ) );

  // One groups fetch per frame, shared by the drag layer (mouse + touch) and
  // the camera pinch pointers.
  const groups = getPointerGroups( interaction );

  const {
    hovers,
    grabbed,
    released
  } = draggable.update( {
    targets: pointsPx,
    radius: grabRadius,
    groups,
    extraPointers: collectCameraPointers(
      o,
      groups
    ),
    onMove: (
      index, pointer
    ) => {
      const moved = {
        x: clamp01( pointer.x / p.width ),
        y: clamp01( pointer.y / p.height )
      };

      state.points[ index ] = moved;
      pointsPx[ index ] = p.createVector(
        moved.x * p.width,
        moved.y * p.height
      );
    }
  } );

  if ( released ) {
    persistPoints();
  }

  if ( pointsPx.length >= 2 ) {
    renderSplines(
      [
        pointsPx
      ],
      {
        curve: o.curve ?? {},
        stroke: o.stroke ?? {},
        overlay: o.overlay ?? {}
      }
    );
  }

  drawHighlight(
    p,
    pointsPx,
    hovers,
    grabbed,
    o.overlay?.points?.size ?? 16
  );

  // Camera feedback (per hand) and the optional webcam preview, drawn last so
  // they stack on top. Both no-op unless Vision is on / a hand is seen.
  drawCameraFeedback( p );
  drawInteractionCameraPreview( interaction );
} );
