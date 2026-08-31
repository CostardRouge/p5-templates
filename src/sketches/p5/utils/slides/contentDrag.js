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
// it — i.e. every item in ContentItemSchema except the three that have no
// single position of their own: "background" (fills the canvas), "meta" (four
// corner labels, each pinned to its corner) and "hud" (handled below, one grab
// target per offset-anchored widget).
const DRAGGABLE_TYPES = new Set( [
  "text",
  "title",
  "image",
  "images-stack",
  "visual",
  "qrcode",
  "specs",
  "breakdown"
] );

// Items whose renderer offsets the anchor by the item's own margins:
// `string.write` draws them at (margin + position) * size (see drawSlideText /
// drawSlideTitle), so their grab anchor sits margin-shifted and a drag writes
// position = pointer − margin. Everything else anchors at position * size.
const MARGIN_ANCHORED_TYPES = new Set( [
  "text",
  "title"
] );

// A "hud" content item has no single position of its own — instead it holds
// several telemetry widgets, each of which carries its own normalized `offset`
// anchor and draws independently. Those widgets are draggable SUB-ITEMS: each
// becomes its own grab target (identified by a `part` key on top of the item's
// scope + index) and a drag writes back item[part].offset rather than
// item.position. Only the offset-anchored widgets are listed here — crosshairs
// (positioned by a data source) and boundingBox (a region rect) place
// themselves differently and aren't offset-draggable. Ordered to match their
// draw order in drawSlideHud (later = on top) so hit-testing picks the widget
// drawn on top when two overlap.
const HUD_DRAGGABLE_WIDGETS = [
  "sparkline",
  "gauge",
  "swatch",
  "counter",
  "badge"
];

// Per-widget offset defaults (mirroring the Hud*Schema defaults) so a widget
// with no persisted offset still resolves the anchor point it actually draws at.
const HUD_OFFSET_DEFAULTS = {
  badge: {
    x: 0.95,
    y: 0.06
  },
  gauge: {
    x: 0.05,
    y: 0.9
  },
  sparkline: {
    x: 0.95,
    y: 0.9
  },
  counter: {
    x: 0.05,
    y: 0.85
  },
  swatch: {
    x: 0.95,
    y: 0.2
  }
};

// Pick-up radius around an item's anchor point, in ON-SCREEN (CSS) pixels.
// Converted to canvas-pixel space per use (see grabRadius) so the touch target
// stays the same physical size on every device — a fixed canvas-pixel radius
// collapses to a handful of screen pixels on a phone (a 1080-wide buffer shown
// ~380px wide), which made items feel un-grabbable on mobile.
const GRAB_RADIUS_SCREEN_PX = 44;

// Anchor-marker geometry, in ON-SCREEN (CSS) pixels for the same reason.
const ANCHOR_RING_SCREEN_PX = 9;
const ANCHOR_ARM_SCREEN_PX = 7;

// Affordance colours: neutral white while the pointer only hovers an item,
// blue once it is held.
const HOVER_COLOR = [
  255,
  255,
  255,
  170
];
const GRAB_COLOR = [
  120,
  200,
  255,
  230
];

export const GLOBAL_CONTENT_SCOPE = "global";

// The montage variant-title overlay (slide.transition.title) is a slide-level
// positioned label, NOT a content-list item — so it can't be addressed by an
// array index. It gets this sentinel "index" within its slide scope instead,
// giving it a bounds/override key of `slide:<n>:montage-title` alongside the
// numeric content-item keys it can never collide with.
export const MONTAGE_TITLE_INDEX = "montage-title";

// Renderer defaults for the montage title anchor (mirrors drawMontageTitle).
const MONTAGE_TITLE_DEFAULTS = {
  x: 0.95,
  y: 0.08
};

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
// each schema's own `position` default; everything else centres).
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
    case "breakdown":
      return {
        x: 0.06,
        y: 0.08
      };
    case "text":
      return {
        x: 0,
        y: 0.5
      };
    case "title":
    case "visual":
      return {
        x: 0,
        y: 0
      };
    default:
      return {
        x: 0.5,
        y: 0.5
      };
  }
}

// The margin a MARGIN_ANCHORED_TYPES item shifts its anchor by (matching the
// renderers' own `parseFloatDefault` fallback).
function itemMargin( item ) {
  if ( !MARGIN_ANCHORED_TYPES.has( item?.type ) ) {
    return {
      h: 0,
      v: 0
    };
  }

  const horizontal = Number.parseFloat( item.margin?.horizontal );
  const vertical = Number.parseFloat( item.margin?.vertical );

  return {
    h: Number.isFinite( horizontal ) ? horizontal : 0.015,
    v: Number.isFinite( vertical ) ? vertical : 0.015
  };
}

// `part` scopes the key to a draggable sub-item (a HUD widget) within the item;
// omit it for a whole-item (position) drag.
function overrideKey(
  scope, index, part
) {
  const base = `${ scope }:${ index }`;

  return part == null ? base : `${ base }:${ part }`;
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

  // Whole-item position override (text, specs, qrcode, …).
  const positionOverride = overrides.get( overrideKey(
    scope,
    index
  ) );

  let next = positionOverride
    ? {
      ...item,
      position: {
        ...( item.position ?? {} ),
        x: positionOverride.x,
        y: positionOverride.y
      }
    }
    : item;

  // Per-widget offset overrides (HUD sub-items).
  if ( item.type === "hud" ) {
    for ( const key of HUD_DRAGGABLE_WIDGETS ) {
      const widgetOverride = overrides.get( overrideKey(
        scope,
        index,
        key
      ) );

      if ( !widgetOverride ) {
        continue;
      }

      next = {
        ...next,
        [ key ]: {
          ...( next[ key ] ?? {} ),
          offset: {
            ...( next[ key ]?.offset ?? {} ),
            x: widgetOverride.x,
            y: widgetOverride.y
          }
        }
      };
    }
  }

  return next;
}

/**
 * The montage title's live position for the given slide while it is being
 * dragged, or its stored position otherwise. drawMontageTitle calls this so the
 * label follows the pointer before the move is persisted (the overlay renders
 * outside freeLayout, so it can't go through resolveDraggedItem).
 */
export function resolveMontageTitlePosition(
  slideIndex, position
) {
  if ( overrides.size === 0 ) {
    return position;
  }

  const override = overrides.get( overrideKey(
    slideContentScope( slideIndex ),
    MONTAGE_TITLE_INDEX
  ) );

  return override ?? position;
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
      if ( !item ) {
        return;
      }

      // A HUD item contributes one grab target PER enabled offset-anchored
      // widget instead of a single item-level target.
      if ( item.type === "hud" ) {
        HUD_DRAGGABLE_WIDGETS.forEach( ( key ) => {
          const widget = item[ key ];

          if ( !widget?.enabled ) {
            return;
          }

          const defaults = HUD_OFFSET_DEFAULTS[ key ];
          const override = overrides.get( overrideKey(
            scope,
            index,
            key
          ) );
          const offset = override ?? widget.offset ?? {};

          targets.push( {
            x: ( offset.x ?? defaults.x ) * p.width,
            y: ( offset.y ?? defaults.y ) * p.height,
            bounds: getItemBounds(
              scope,
              index,
              key
            ),
            scope,
            index,
            part: key,
            marginX: 0,
            marginY: 0
          } );
        } );

        return;
      }

      if ( !DRAGGABLE_TYPES.has( item.type ) ) {
        return;
      }

      // A roaming breakdown places itself (corner tour, one anchor per step)
      // and ignores item.position entirely. It must be excluded HERE — the
      // hit-test's anchor-disc fallback would otherwise still grab it at its
      // unused stored position even though it reports no bounds.
      if ( item.type === "breakdown" && item.placement === "roaming" ) {
        return;
      }

      const defaults = positionDefaults( item.type );
      const override = overrides.get( overrideKey(
        scope,
        index
      ) );
      const position = override ?? item.position ?? {};
      const margin = itemMargin( item );

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
        part: null,
        marginX: margin.h,
        marginY: margin.v
      } );
    } );
  };

  const slidesArray = Array.isArray( store.slides ) ? store.slides : [];

  if ( slidesArray.length > 0 ) {
    const slideIndex = currentSlideIndex( slidesArray.length );
    const slide = slidesArray[ slideIndex ];

    add(
      slideContentScope( slideIndex ),
      slide?.content
    );

    // Montage variant-title overlay: a slide-level positioned label, draggable
    // when the current slide's montage transition and its title are both on.
    if ( slide?.transition?.enabled && slide.transition.title?.enabled ) {
      const scope = slideContentScope( slideIndex );
      const override = overrides.get( overrideKey(
        scope,
        MONTAGE_TITLE_INDEX
      ) );
      const position = override ?? slide.transition.title.position ?? {};

      targets.push( {
        x: ( position.x ?? MONTAGE_TITLE_DEFAULTS.x ) * p.width,
        y: ( position.y ?? MONTAGE_TITLE_DEFAULTS.y ) * p.height,
        bounds: getItemBounds(
          scope,
          MONTAGE_TITLE_INDEX
        ),
        scope,
        index: MONTAGE_TITLE_INDEX,
        part: null,
        marginX: 0,
        marginY: 0
      } );
    }
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
      activeDrag.index,
      activeDrag.part
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
    if ( !item ) {
      return item;
    }

    let updated = item;

    const positionOverride = overrides.get( overrideKey(
      scope,
      index
    ) );

    if ( positionOverride ) {
      changed = true;
      updated = {
        ...updated,
        position: {
          ...( updated.position ?? {} ),
          x: positionOverride.x,
          y: positionOverride.y
        }
      };
    }

    // HUD sub-items persist into item[widget].offset, not item.position.
    if ( item.type === "hud" ) {
      for ( const key of HUD_DRAGGABLE_WIDGETS ) {
        const widgetOverride = overrides.get( overrideKey(
          scope,
          index,
          key
        ) );

        if ( !widgetOverride ) {
          continue;
        }

        changed = true;
        updated = {
          ...updated,
          [ key ]: {
            ...( updated[ key ] ?? {} ),
            offset: {
              ...( updated[ key ]?.offset ?? {} ),
              x: widgetOverride.x,
              y: widgetOverride.y
            }
          }
        };
      }
    }

    return updated;
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
    const scope = slideContentScope( slideIndex );
    let nextSlide = slide;

    const nextContentList = applyToContent(
      scope,
      slide?.content
    );

    if ( nextContentList ) {
      nextSlide = {
        ...nextSlide,
        content: nextContentList
      };
    }

    // Montage title position lives at slide.transition.title.position — not in
    // the content list, so it persists here rather than through applyToContent.
    const titleOverride = overrides.get( overrideKey(
      scope,
      MONTAGE_TITLE_INDEX
    ) );

    if ( titleOverride && slide?.transition?.title ) {
      nextSlide = {
        ...nextSlide,
        transition: {
          ...nextSlide.transition,
          title: {
            ...nextSlide.transition.title,
            position: {
              ...( nextSlide.transition.title.position ?? {} ),
              x: titleOverride.x,
              y: titleOverride.y
            }
          }
        }
      };
    }

    if ( nextSlide !== slide ) {
      slidesChanged = true;
    }

    return nextSlide;
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

// Tell the options panel which item was just pressed on the canvas, so it can
// reveal that item's form section (open its zone/slide, open + scroll to it,
// and pulse it). Fires on grab — covering both a click and the start of a drag.
// The event name is duplicated in the React constant CONTENT_ITEM_SELECT_EVENT
// (constants/drawer-events.ts) — keep the two literals in sync.
function emitContentItemSelect( target ) {
  if ( typeof window === "undefined" || !target ) {
    return;
  }

  window.dispatchEvent( new CustomEvent(
    "studio:content-item-select",
    {
      detail: {
        scope: target.scope,
        index: target.index,
        part: target.part ?? null
      }
    }
  ) );
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

  // Surface the pressed item in the options panel (click or drag-start).
  emitContentItemSelect( target );

  activeDrag = {
    pointerId: event.pointerId,
    scope: target.scope,
    index: target.index,
    part: target.part,
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
    targets[ hit ].index,
    targets[ hit ].part
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
      target.index === activeDrag.index &&
      target.part === activeDrag.part
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

  // The anchor: the exact point the item's stored `position` refers to, drawn
  // as a crosshair-in-a-ring. It is shown on HOVER as well as while dragging,
  // because an item's anchor is routinely nowhere near its glyphs — rect-mode
  // text centres its letters inside a near-full-width layout box, so a text at
  // position.x = 0 draws mid-canvas with its anchor on the left edge. Without
  // the marker the `position` field in the inspector reads as an arbitrary pair
  // of numbers; with it, the outline says what you can grab and the anchor says
  // what the numbers mean. Sized in SCREEN pixels (like the pick-up radius) so
  // it stays legible whatever the canvas buffer size.
  const anchor = (
    target, color, weight
  ) => {
    const scale = getCanvasDisplayScale();
    const ring = ANCHOR_RING_SCREEN_PX * scale;
    const arm = ANCHOR_ARM_SCREEN_PX * scale;

    p.stroke( ...color );
    p.strokeWeight( weight );

    // Leader line to the nearest edge of the drawn rectangle when the anchor
    // falls outside it, so the marker reads as part of the item and not as a
    // second, unrelated thing on the canvas.
    if ( target.bounds ) {
      const nearestX = Math.min(
        Math.max(
          target.x,
          target.bounds.x
        ),
        target.bounds.x + target.bounds.w
      );
      const nearestY = Math.min(
        Math.max(
          target.y,
          target.bounds.y
        ),
        target.bounds.y + target.bounds.h
      );

      if ( nearestX !== target.x || nearestY !== target.y ) {
        p.line(
          target.x,
          target.y,
          nearestX,
          nearestY
        );
      }
    }

    p.line(
      target.x - arm,
      target.y,
      target.x + arm,
      target.y
    );
    p.line(
      target.x,
      target.y - arm,
      target.x,
      target.y + arm
    );
    p.circle(
      target.x,
      target.y,
      ring
    );
  };

  p.push();
  p.noFill();

  hovers.forEach( ( index ) => {
    outline(
      targets[ index ],
      HOVER_COLOR,
      2
    );
    anchor(
      targets[ index ],
      HOVER_COLOR,
      1.5
    );
  } );

  grabbed.forEach( ( index ) => {
    outline(
      targets[ index ],
      GRAB_COLOR,
      3
    );
    anchor(
      targets[ index ],
      GRAB_COLOR,
      2
    );
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
