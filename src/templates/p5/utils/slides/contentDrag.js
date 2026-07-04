import events from "../events.js";
import sketch, {
  getP5
} from "../sketch.js";
import {
  isPaused
} from "../loopControl.js";
import {
  getSketchOptions,
  setSketchOptions
} from "../../shared/syncSketchOptions.js";
import {
  getCanvasDisplayScale,
  clientToCanvas
} from "../interaction/pointerTracking.js";
import {
  getItemBounds,
  clearItemBounds
} from "./common/itemBoundsRegistry.js";

// ── On-canvas drag for template content items ──────────────────────────────
// Every positioned content item — the global "content" list edited in the
// template options AND the per-slide lists edited in the slide editor — can be
// grabbed BY ITS VISIBLE BODY and moved with the mouse or a finger. Engine-
// level: registered from slides/index.js for every template, no per-sketch code.
//
// Grab what you see. This mirrors why splines-v2-draggable always felt right:
// there, the visible dots ARE the drag anchors. A content item's normalized
// `position` anchor, by contrast, is often nowhere near its drawn pixels
// (rect-mode text centres its glyphs inside a near-full-width layout box, so a
// fresh text item at position.x = 0 draws mid-canvas while its anchor sits on
// the left edge). Hit-testing a disc around the anchor therefore missed the
// item the user was actually clicking, and the press fell through to a
// viewport pan. Instead, every renderer reports the rectangle it actually
// drew (itemBoundsRegistry, bracketed per item by freeLayout) and the press
// is tested against those visible rectangles — topmost first, with the
// anchor disc kept only as a fallback for items whose renderer reported
// nothing this frame (e.g. "visual", whose size isn't measurable).
//
// Why this owns raw pointer events instead of the shared draggable layer:
// content templates don't necessarily animate every frame, and the canvas
// lives inside ScalableViewport, whose @use-gesture drag recogniser treats any
// press-and-move as a pan. The earlier approach set a `data-no-drag` attribute
// during hover and hoped the viewport would cancel its own pan — which fails
// whenever the draw loop isn't tagging in time, so the pan won every gesture.
// Here a capture-phase `pointerdown` on `window` hit-tests the press and, when
// it lands on an item, calls `stopImmediatePropagation()` BEFORE the event ever
// reaches the viewport's listeners — so the pan cannot start at all. The drag
// then runs entirely from pointer events (mouse + touch + pen unified), so it
// no longer depends on the p5 loop or on the viewport cooperating.
//
// Positions are stored NORMALIZED (0..1) in item.position (resize-proof, saved/
// exported with the template). While a drag is live the moved position lives in
// an override map that freeLayout consults when it renders (via
// resolveDraggedItem); the store is written only on RELEASE (setSketchOptions
// origin "p5", so the options module skips its own change handler — no feedback
// loop — while React still picks the new values up in the form).

// Content item types that carry a normalized `position` and render anchored to
// it ("meta", "background", "hud" and "images" are laid out differently).
const DRAGGABLE_TYPES = new Set( [
  "text",
  "image",
  "images-stack",
  "visual",
  "qrcode",
  "specs"
] );

// Pick-up radius around an item's anchor point, in ON-SCREEN (CSS) pixels.
// Converted to canvas-pixel space per use (see grabRadius) so the touch target
// stays the same physical size on every device — a fixed canvas-pixel radius
// collapses to a handful of screen pixels on a phone (a 1080-wide buffer shown
// ~380px wide), which made items feel un-grabbable on mobile.
const GRAB_RADIUS_SCREEN_PX = 44;

export const GLOBAL_CONTENT_SCOPE = "global";

export function slideContentScope( index ) {
  return `slide:${ index }`;
}

// Live drag overrides: `${scope}:${contentIndex}` → normalized { x, y }
// position. Consulted by freeLayout while a drag is in flight; flushed into the
// option store on release.
const overrides = new Map();

// The pointer currently dragging an item, or null. `pointerId` scopes every
// move/up to the exact pointer that grabbed, so multi-touch elsewhere can't
// hijack the drag.
let activeDrag = null;

// Last hover position (canvas px) for the mouse, or null. Drives the hover ring
// and the "move" cursor; touch never hovers.
let hoverPoint = null;

// The target index the mouse last hovered, so a paused sketch can be nudged to
// redraw only when the ring should appear/disappear (not on every mouse move).
let lastHoverKey = null;

// Wired DOM listeners, kept so a re-register (next sketch start) can detach the
// previous set.
let domListeners = null;
let unregisterPostDraw = null;

function clamp01( value ) {
  return Math.min(
    1,
    Math.max(
      0,
      value
    )
  );
}

// The renderers' fallback anchors when an item has no position yet (matching
// drawSlideQrCode / drawSlideSpecs defaults; everything else centres).
function positionDefaults( type ) {
  switch ( type ) {
    case "qrcode":
      return {
        x: 0.5,
        y: 0.82
      };
    case "specs":
      return {
        x: 0.05,
        y: 0.06
      };
    default:
      return {
        x: 0.5,
        y: 0.5
      };
  }
}

// Text renders at (margin + position) * size (see drawSlideText), so its grab
// anchor is offset by the margin — and a drag writes position = pointer − margin.
function textMargin( item ) {
  const horizontal = Number.parseFloat( item.margin?.horizontal );
  const vertical = Number.parseFloat( item.margin?.vertical );

  return {
    h: Number.isFinite( horizontal ) ? horizontal : 0.015,
    v: Number.isFinite( vertical ) ? vertical : 0.015
  };
}

function overrideKey(
  scope, index
) {
  return `${ scope }:${ index }`;
}

/**
 * The item as it should render this frame: while it is being dragged, its live
 * (not yet persisted) position replaces the stored one. Called by freeLayout
 * for every content item; returns the item untouched when no drag is in flight.
 */
export function resolveDraggedItem(
  scope, index, item
) {
  if ( overrides.size === 0 || !scope || !item ) {
    return item;
  }

  const override = overrides.get( overrideKey(
    scope,
    index
  ) );

  if ( !override ) {
    return item;
  }

  return {
    ...item,
    position: {
      ...( item.position ?? {} ),
      x: override.x,
      y: override.y
    }
  };
}

// Same wrap as slides/index.js uses to resolve the rendered slide, so the scope
// written here always matches the scope freeLayout renders with.
function currentSlideIndex( count ) {
  const raw = typeof window !== "undefined"
    ? window.getCurrentSlide?.()?.index
    : 0;
  const index = Number( raw ) || 0;

  return ( ( index % count ) + count ) % count;
}

// Every draggable content item on screen right now, as pixel-space grab targets
// carrying where they came from (scope + index) so a move knows where to write
// back. Current slide items first, then the global list — freeLayout draws them
// in that order too.
function collectTargets( p ) {
  const store = getSketchOptions();
  const targets = [];

  const add = (
    scope, content
  ) => {
    if ( !Array.isArray( content ) ) {
      return;
    }

    content.forEach( (
      item, index
    ) => {
      if ( !item || !DRAGGABLE_TYPES.has( item.type ) ) {
        return;
      }

      const defaults = positionDefaults( item.type );
      const override = overrides.get( overrideKey(
        scope,
        index
      ) );
      const position = override ?? item.position ?? {};
      const margin = item.type === "text" ? textMargin( item ) : {
        h: 0,
        v: 0
      };

      targets.push( {
        x: ( ( position.x ?? defaults.x ) + margin.h ) * p.width,
        y: ( ( position.y ?? defaults.y ) + margin.v ) * p.height,
        // Where the item was actually drawn (canvas px), when its renderer
        // reported it — the primary grab surface.
        bounds: getItemBounds(
          scope,
          index
        ),
        scope,
        index,
        marginX: margin.h,
        marginY: margin.v
      } );
    } );
  };

  const slidesArray = Array.isArray( store.slides ) ? store.slides : [];

  if ( slidesArray.length > 0 ) {
    const slideIndex = currentSlideIndex( slidesArray.length );

    add(
      slideContentScope( slideIndex ),
      slidesArray[ slideIndex ]?.content
    );
  }

  add(
    GLOBAL_CONTENT_SCOPE,
    store.content
  );

  return targets;
}

// Canvas-pixel pick-up radius for the current display scale.
function grabRadius() {
  return GRAB_RADIUS_SCREEN_PX * getCanvasDisplayScale();
}

// Extra forgiveness (canvas px) around a visible rect so near-edge presses
// still grab; sized in screen pixels like the anchor radius.
function boundsPadding() {
  return 10 * getCanvasDisplayScale();
}

/**
 * The target under a canvas-space point, or -1. Visible rectangles win; the
 * anchor disc only catches items whose renderer reported no bounds this
 * frame. Targets are in draw order (current slide first, then global, each
 * list front-to-back), so the LAST hit is the one drawn on top.
 */
function hitTest(
  point, targets
) {
  const radius = grabRadius();
  const pad = boundsPadding();
  let hit = -1;

  targets.forEach( (
    target, index
  ) => {
    const bounds = target.bounds;

    if ( bounds ) {
      if (
        point.x >= bounds.x - pad &&
        point.x <= bounds.x + bounds.w + pad &&
        point.y >= bounds.y - pad &&
        point.y <= bounds.y + bounds.h + pad
      ) {
        hit = index;
      }

      return;
    }

    const dx = target.x - point.x;
    const dy = target.y - point.y;

    if ( dx * dx + dy * dy <= radius * radius ) {
      hit = index;
    }
  } );

  return hit;
}

// Write the dragged item's live position from a canvas-space pointer point.
// The grab offset (anchor − pointer at grab time) is preserved so the item
// follows the hand from wherever it was picked up instead of snapping its
// anchor under the cursor.
function applyMove(
  p, point
) {
  if ( !activeDrag ) {
    return;
  }

  overrides.set(
    overrideKey(
      activeDrag.scope,
      activeDrag.index
    ),
    {
      x: clamp01( point.x / p.width + activeDrag.offsetX - activeDrag.marginX ),
      y: clamp01( point.y / p.height + activeDrag.offsetY - activeDrag.marginY )
    }
  );
}

// Apply the pending overrides to one content list. Returns the new list, or
// null when nothing in it was dragged.
function applyToContent(
  scope, content
) {
  if ( !Array.isArray( content ) ) {
    return null;
  }

  let changed = false;

  const next = content.map( (
    item, index
  ) => {
    const override = overrides.get( overrideKey(
      scope,
      index
    ) );

    if ( !override || !item ) {
      return item;
    }

    changed = true;

    return {
      ...item,
      position: {
        ...( item.position ?? {} ),
        x: override.x,
        y: override.y
      }
    };
  } );

  return changed ? next : null;
}

// Persist the dragged positions into the saved options so they survive reloads
// and are exported with the template.
function persistOverrides() {
  if ( overrides.size === 0 ) {
    return;
  }

  const store = getSketchOptions();
  const update = {};

  const nextContent = applyToContent(
    GLOBAL_CONTENT_SCOPE,
    store.content
  );

  if ( nextContent ) {
    update.content = nextContent;
  }

  const slidesArray = Array.isArray( store.slides ) ? store.slides : [];
  let slidesChanged = false;

  const nextSlides = slidesArray.map( (
    slide, slideIndex
  ) => {
    const next = applyToContent(
      slideContentScope( slideIndex ),
      slide?.content
    );

    if ( !next ) {
      return slide;
    }

    slidesChanged = true;

    return {
      ...slide,
      content: next
    };
  } );

  if ( slidesChanged ) {
    update.slides = nextSlides;
  }

  overrides.clear();

  if ( Object.keys( update ).length > 0 ) {
    setSketchOptions(
      update,
      "p5"
    );
  }
}

// A static (noLoop) sketch won't redraw on its own, so nudge it once so the
// moved item and its ring show immediately. A looping sketch redraws anyway —
// don't double-draw it.
function requestRedraw( p ) {
  if (
    p &&
    typeof p.isLooping === "function" &&
    !p.isLooping() &&
    typeof p.redraw === "function"
  ) {
    p.redraw();
  }
}

// Hover only ever toggles a UI affordance (the ring/cursor) — unlike a real
// drag, it isn't a change the user asked to see reflected in the canvas, so it
// must not draw a frame while the sketch is explicitly paused. `isLooping()`
// alone can't tell "paused" apart from "static by design", which used to make
// hovering (and mouse-leave) force a frame even while paused.
function requestHoverRedraw( p ) {
  if ( isPaused( p ) ) {
    return;
  }

  requestRedraw( p );
}

function setCursor( value ) {
  const element = sketch.getCanvasElement?.();

  if ( element && element.style.cursor !== value ) {
    element.style.cursor = value;
  }
}

// ── Pointer handlers (capture phase on window, ahead of the viewport) ───────

function onPointerDown( event ) {
  const p = getP5();

  if ( !p ) {
    return;
  }

  const element = sketch.getCanvasElement?.();

  // Only presses that land directly on the sketch canvas are ours; UI chrome
  // and empty page area fall through untouched so normal panning still works.
  if ( !element || event.target !== element ) {
    return;
  }

  // Left button / primary pointer only.
  if ( event.pointerType === "mouse" && event.button !== 0 ) {
    return;
  }

  const point = clientToCanvas(
    event.clientX,
    event.clientY
  );

  if ( !point ) {
    return;
  }

  const targets = collectTargets( p );
  const hit = hitTest(
    point,
    targets
  );

  // Missed every item — let the viewport pan as usual.
  if ( hit === -1 ) {
    return;
  }

  // We own this gesture: stop it before the viewport's recogniser sees it.
  event.stopImmediatePropagation();
  event.preventDefault();

  const target = targets[ hit ];

  activeDrag = {
    pointerId: event.pointerId,
    scope: target.scope,
    index: target.index,
    marginX: target.marginX,
    marginY: target.marginY,
    // Anchor − pointer at grab time (normalized), so the item follows from
    // where it was picked up instead of jumping its anchor under the cursor.
    offsetX: target.x / p.width - point.x / p.width,
    offsetY: target.y / p.height - point.y / p.height
  };

  try {
    element.setPointerCapture?.( event.pointerId );
  } catch {
    // Capture is best-effort; window listeners already see every move.
  }

  applyMove(
    p,
    point
  );
  setCursor( "grabbing" );
  requestRedraw( p );
}

function onPointerMove( event ) {
  // Active drag: follow the exact pointer that grabbed.
  if ( activeDrag && event.pointerId === activeDrag.pointerId ) {
    event.stopImmediatePropagation();

    const p = getP5();
    const point = p && clientToCanvas(
      event.clientX,
      event.clientY
    );

    if ( p && point ) {
      applyMove(
        p,
        point
      );
      requestRedraw( p );
    }

    return;
  }

  if ( activeDrag ) {
    return;
  }

  // Hover (mouse/pen only): update the ring + cursor. Never stops the event, so
  // panning empty canvas still works.
  if ( event.pointerType === "touch" ) {
    return;
  }

  const p = getP5();
  const element = sketch.getCanvasElement?.();

  if ( !p || !element || event.target !== element ) {
    if ( hoverPoint ) {
      hoverPoint = null;
      lastHoverKey = null;
      setCursor( "" );
      requestHoverRedraw( p );
    }

    return;
  }

  const point = clientToCanvas(
    event.clientX,
    event.clientY
  );

  if ( !point ) {
    return;
  }

  hoverPoint = point;

  const targets = collectTargets( p );
  const hit = hitTest(
    point,
    targets
  );
  const key = hit === -1 ? null : overrideKey(
    targets[ hit ].scope,
    targets[ hit ].index
  );

  setCursor( hit === -1 ? "" : "move" );

  // Only force a redraw when the hovered item actually changes, so a static
  // sketch shows/hides the ring without redrawing on every mouse move — and
  // not at all while explicitly paused.
  if ( key !== lastHoverKey ) {
    lastHoverKey = key;
    requestHoverRedraw( p );
  }
}

function onPointerUp( event ) {
  if ( !activeDrag || event.pointerId !== activeDrag.pointerId ) {
    return;
  }

  event.stopImmediatePropagation();

  const element = sketch.getCanvasElement?.();

  try {
    element?.releasePointerCapture?.( event.pointerId );
  } catch {
    // Ignore — the capture may already be gone.
  }

  persistOverrides();
  activeDrag = null;
  setCursor( "" );
  requestRedraw( getP5() );
}

// ── Ring affordance (drawn on top of the content items each draw) ───────────

function drawAffordance() {
  const p = getP5();

  if ( !p ) {
    return;
  }

  const targets = collectTargets( p );

  if ( targets.length === 0 ) {
    // Nothing draggable on screen — drop stale overrides so a removed item's
    // ghost position can't resurface if items are re-added.
    if ( !activeDrag ) {
      overrides.clear();
    }

    return;
  }

  const hovers = new Set();
  const grabbed = new Set();

  targets.forEach( (
    target, index
  ) => {
    if (
      activeDrag &&
      target.scope === activeDrag.scope &&
      target.index === activeDrag.index
    ) {
      grabbed.add( index );
    }
  } );

  if ( !activeDrag && hoverPoint ) {
    const hit = hitTest(
      hoverPoint,
      targets
    );

    if ( hit !== -1 ) {
      hovers.add( hit );
    }
  }

  if ( hovers.size === 0 && grabbed.size === 0 ) {
    return;
  }

  // Outline the grabbable surface itself — the item's visible rectangle —
  // so the affordance shows exactly what a press will pick up. Anchor circle
  // only for items without reported bounds (e.g. "visual").
  const outline = (
    target, color, weight
  ) => {
    p.stroke( ...color );
    p.strokeWeight( weight );

    if ( target.bounds ) {
      const pad = boundsPadding() / 2;

      p.rect(
        target.bounds.x - pad,
        target.bounds.y - pad,
        target.bounds.w + pad * 2,
        target.bounds.h + pad * 2,
        6
      );
    } else {
      p.circle(
        target.x,
        target.y,
        grabRadius()
      );
    }
  };

  p.push();
  p.noFill();

  hovers.forEach( ( index ) => {
    outline(
      targets[ index ],
      [
        255,
        255,
        255,
        170
      ],
      2
    );
  } );

  grabbed.forEach( ( index ) => {
    const target = targets[ index ];

    outline(
      target,
      [
        120,
        200,
        255,
        230
      ],
      3
    );

    // Anchor dot: the point the stored `position` refers to.
    p.noStroke();
    p.fill(
      120,
      200,
      255,
      230
    );
    p.circle(
      target.x,
      target.y,
      6
    );
    p.noFill();
  } );

  p.pop();
}

function detachDom() {
  if ( domListeners && typeof window !== "undefined" ) {
    window.removeEventListener(
      "pointerdown",
      domListeners.down,
      {
        capture: true
      }
    );
    window.removeEventListener(
      "pointermove",
      domListeners.move,
      {
        capture: true
      }
    );
    window.removeEventListener(
      "pointerup",
      domListeners.up,
      {
        capture: true
      }
    );
    window.removeEventListener(
      "pointercancel",
      domListeners.up,
      {
        capture: true
      }
    );
  }

  domListeners = null;
}

/**
 * Called from slides.registerEvents() on every sketch start (the engine event
 * registry is cleared on reset). Registration order matters: slides registers
 * its render handlers first, so this post-draw runs after the content items
 * were drawn and the ring stacks on top.
 */
export function registerContentDrag() {
  overrides.clear();
  clearItemBounds();
  activeDrag = null;
  hoverPoint = null;
  lastHoverKey = null;

  // Re-arm from a clean slate: the previous sketch's listeners are orphaned.
  detachDom();

  if ( typeof window !== "undefined" ) {
    domListeners = {
      down: onPointerDown,
      move: onPointerMove,
      up: onPointerUp
    };
    window.addEventListener(
      "pointerdown",
      domListeners.down,
      {
        capture: true
      }
    );
    window.addEventListener(
      "pointermove",
      domListeners.move,
      {
        capture: true
      }
    );
    window.addEventListener(
      "pointerup",
      domListeners.up,
      {
        capture: true
      }
    );
    window.addEventListener(
      "pointercancel",
      domListeners.up,
      {
        capture: true
      }
    );
  }

  unregisterPostDraw?.();
  unregisterPostDraw = events.register(
    "post-draw",
    drawAffordance
  );
}
