import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import events from "@/p5/utils/events.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
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
//   2. Dragging never pans the viewport. Touch is claimed by enabling
//      `interaction.touch` (TemplateSketchPage flips disableTouchGestures), and
//      the mouse drag is kept off the pan by tagging the canvas `data-no-drag`
//      while a point is under the cursor (the viewport cancels its pan on that
//      hook BEFORE it would pause the loop, so the drag stays live).
//   3. Pointer positions come from the shared interaction layer
//      (getPointerGroups), which converts client → canvas space correctly even
//      when the viewport is zoomed/panned. Mouse press state comes from the
//      engine's wired canvas events; a touch counts as "pressed" while present.
//
// The grab → move → release state machine is source-agnostic, so all three
// inputs feed the same path as one { x, y, pressed } pointer:
//   - touch  → present finger, always "pressed"
//   - camera → enable Vision → Hands; the thumb+index midpoint is the pointer
//              and a PINCH (the two tips closer than the threshold) is "pressed",
//              so you literally pinch a point and move it. No viewport conflict —
//              the camera emits no pointer events.
//   - mouse  → cursor position + button state.
// Priority is touch > camera (when a hand is visible) > mouse.

const state = {
  // Working copy of the control points, normalized [0..1].
  points: [],
  // `${count}|${seed}` signature: a change means "regenerate the layout".
  signature: null,
  // JSON of the items we last took from / wrote to the store, so we can tell an
  // external edit (form, reload) apart from our own drag write.
  syncHash: null,
  // Mouse button state, fed by the engine's wired canvas events.
  mouseDown: false,
  hover: -1,
  drag: {
    active: false,
    index: -1
  },
  // Whether the canvas currently carries the `data-no-drag` attribute.
  noDrag: false,
  // Latest camera hand for feedback drawing: { thumb, index, mid, pinching }.
  camera: null,
  // EMA-smoothed pinch midpoint (camera landmarks are jittery), kept separate
  // so mouse/touch stay perfectly crisp.
  cameraSmooth: null,
  // Pinch latch (hysteresis) so a borderline gap doesn't flicker the grab.
  pinching: false
};

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

function nearestIndex(
  pointsPx, x, y, radius
) {
  let best = -1;
  let bestDistance = radius * radius;

  for ( let i = 0; i < pointsPx.length; i++ ) {
    const dx = pointsPx[ i ].x - x;
    const dy = pointsPx[ i ].y - y;
    const distance = dx * dx + dy * dy;

    if ( distance < bestDistance ) {
      bestDistance = distance;
      best = i;
    }
  }

  return best;
}

// Tag the canvas so the viewport's gesture layer cancels a mouse pan when the
// cursor is over (or dragging) a point, and reflect the grab state in the
// cursor. Touch never needs this — its gestures are already disabled.
function updateCanvasAffordance(
  wantNoDrag, grabbing
) {
  const element = sketch.getCanvasElement?.();

  if ( !element ) {
    return;
  }

  if ( wantNoDrag !== state.noDrag ) {
    if ( wantNoDrag ) {
      element.setAttribute(
        "data-no-drag",
        ""
      );
    } else {
      element.removeAttribute( "data-no-drag" );
    }

    state.noDrag = wantNoDrag;
  }

  const cursor = grabbing ? "grabbing" : wantNoDrag ? "grab" : "";

  if ( element.style.cursor !== cursor ) {
    element.style.cursor = cursor;
  }
}

function drawHighlight(
  p, pointsPx, hoverIndex, dragIndex, baseSize
) {
  p.push();
  p.noFill();

  if ( hoverIndex >= 0 && hoverIndex !== dragIndex ) {
    p.stroke(
      255,
      255,
      255,
      170
    );
    p.strokeWeight( 2 );
    p.circle(
      pointsPx[ hoverIndex ].x,
      pointsPx[ hoverIndex ].y,
      baseSize * 1.8 + 10
    );
  }

  if ( dragIndex >= 0 ) {
    p.stroke(
      120,
      200,
      255,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      pointsPx[ dragIndex ].x,
      pointsPx[ dragIndex ].y,
      baseSize * 2.1 + 12
    );
  }

  p.pop();
}

// The thumb + index pinch as a pointer. Returns null (and clears the camera
// feedback) when Vision → Hands is off or no hand is visible.
//
// The hands group is ordered [palm?, thumb, index, middle, ring, pinky]; the
// fingertips are always the trailing five, so the thumb is points[len-5] and
// the index points[len-4] whether or not the palm landmark is included. The
// pointer is their midpoint (EMA-smoothed); "pressed" is true while the two tips
// are closer than `grab.pinch`, with a wider release threshold (hysteresis).
function resolveCameraPointer(
  o, groups
) {
  const vision = o.interaction?.vision;

  if ( !vision?.enabled || !vision.hands?.enabled ) {
    state.camera = null;
    state.cameraSmooth = null;
    state.pinching = false;

    return null;
  }

  const hand = groups.find( ( group ) => group.source === "hands" );

  if ( !hand || hand.points.length < 5 ) {
    state.camera = null;
    state.cameraSmooth = null;
    state.pinching = false;

    return null;
  }

  const points = hand.points;
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

  if ( !state.cameraSmooth ) {
    state.cameraSmooth = {
      x: rawMidX,
      y: rawMidY
    };
  }

  state.cameraSmooth.x += ( rawMidX - state.cameraSmooth.x ) * ( 1 - lag );
  state.cameraSmooth.y += ( rawMidY - state.cameraSmooth.y ) * ( 1 - lag );

  const distance = Math.hypot(
    thumb.x - index.x,
    thumb.y - index.y
  );
  const pinchOn = o.grab?.pinch ?? 70;
  const pinching = state.pinching ? distance < pinchOn * 1.6 : distance < pinchOn;

  state.pinching = pinching;
  state.camera = {
    thumb,
    index,
    mid: {
      x: state.cameraSmooth.x,
      y: state.cameraSmooth.y
    },
    pinching
  };

  return {
    point: {
      x: state.cameraSmooth.x,
      y: state.cameraSmooth.y
    },
    pressed: pinching,
    kind: "camera"
  };
}

// Resolve the active pointer for this frame. A present touch wins (always
// pressed), then a visible camera hand (pressed while pinching), then the mouse
// with its button state.
function resolvePointer( o ) {
  const groups = getPointerGroups( o.interaction );
  const touch = groups.find( ( group ) => group.source === "touch" );

  if ( touch ) {
    return {
      point: touch.points[ 0 ],
      pressed: true,
      kind: "touch"
    };
  }

  const camera = resolveCameraPointer(
    o,
    groups
  );

  if ( camera ) {
    return camera;
  }

  const mouse = groups.find( ( group ) => group.source === "mouse" );

  if ( mouse ) {
    return {
      point: mouse.points[ 0 ],
      pressed: state.mouseDown,
      kind: "mouse"
    };
  }

  return {
    point: null,
    pressed: false,
    kind: null
  };
}

// Thumb + index markers and the connector between them, accented while pinching,
// so the user can see what the camera tracks and when a grab will trigger.
function drawCameraFeedback(
  p, camera
) {
  if ( !camera ) {
    return;
  }

  const color = camera.pinching ? [
    120,
    200,
    255
  ] : [
    255,
    255,
    255
  ];

  p.push();
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
  p.pop();
}

sketch.setup( async() => {
  state.points = [];
  state.signature = null;
  state.syncHash = null;
  state.mouseDown = false;
  state.hover = -1;
  state.drag = {
    active: false,
    index: -1
  };
  state.noDrag = false;
  state.camera = null;
  state.cameraSmooth = null;
  state.pinching = false;

  // Press / release of the mouse button. Press is canvas-scoped (don't grab when
  // clicking UI); release is global so letting go off-canvas still ends a drag.
  events.register(
    "engine-canvas-mouse-pressed",
    () => {
      state.mouseDown = true;
    }
  );
  events.register(
    "engine-mouse-released",
    () => {
      state.mouseDown = false;
    }
  );

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const cfg = o.points ?? {};
  const interaction = o.interaction ?? {};
  const grabRadius = o.grab?.radius ?? 44;

  if ( !state.drag.active ) {
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

  const {
    point, pressed, kind
  } = resolvePointer( o );

  const hit = point
    ? nearestIndex(
      pointsPx,
      point.x,
      point.y,
      grabRadius
    )
    : -1;

  state.hover = !state.drag.active && ( kind === "mouse" || kind === "camera" ) ? hit : -1;

  // Grab on the press edge.
  if ( !state.drag.active && pressed && hit !== -1 ) {
    state.drag.active = true;
    state.drag.index = hit;
  }

  // Move while held, release otherwise.
  if ( state.drag.active ) {
    if ( pressed && point ) {
      const moved = {
        x: clamp01( point.x / p.width ),
        y: clamp01( point.y / p.height )
      };

      state.points[ state.drag.index ] = moved;
      pointsPx[ state.drag.index ] = p.createVector(
        moved.x * p.width,
        moved.y * p.height
      );
    } else {
      state.drag.active = false;
      state.drag.index = -1;
      persistPoints();
    }
  }

  updateCanvasAffordance(
    kind === "mouse" && ( state.drag.active || state.hover !== -1 ),
    state.drag.active
  );

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
    state.hover,
    state.drag.active ? state.drag.index : -1,
    o.overlay?.points?.size ?? 16
  );

  // Camera feedback (thumb/index + pinch) and the optional webcam preview, drawn
  // last so they stack on top. Both no-op unless Vision is on / a hand is seen.
  drawCameraFeedback(
    p,
    state.camera
  );
  drawInteractionCameraPreview( interaction );
} );
