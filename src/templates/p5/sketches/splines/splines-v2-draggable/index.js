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
// The grab → move → release state machine is source-agnostic, so the camera
// (pinch the thumb + index over a point to grab) plugs into the same path in a
// follow-up — it would just feed in another { x, y, pressed } pointer.

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
  noDrag: false
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

// Resolve the active pointer for this frame: a present touch wins (and counts as
// pressed), otherwise the mouse with its button state.
function resolvePointer( interaction ) {
  const groups = getPointerGroups( interaction );
  const touch = groups.find( ( group ) => group.source === "touch" );

  if ( touch ) {
    return {
      point: touch.points[ 0 ],
      pressed: true,
      kind: "touch"
    };
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
  } = resolvePointer( interaction );

  const hit = point
    ? nearestIndex(
      pointsPx,
      point.x,
      point.y,
      grabRadius
    )
    : -1;

  state.hover = !state.drag.active && kind === "mouse" ? hit : -1;

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
} );
