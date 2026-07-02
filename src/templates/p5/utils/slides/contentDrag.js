import events from "../events.js";
import {
  getP5
} from "../sketch.js";
import {
  getSketchOptions,
  setSketchOptions
} from "../../shared/syncSketchOptions.js";
import {
  createDraggable,
  detachAllDraggables
} from "../interaction/draggable.js";
import {
  getCanvasDisplayScale
} from "../interaction/pointerTracking.js";

// ── On-canvas drag for template content items ──────────────────────────────
// Every positioned content item — the global "content" list edited in the
// template options AND the per-slide lists edited in the slide editor — can be
// grabbed at its anchor point and moved with the mouse or a finger, exactly
// like the control points of splines-v2-draggable (same shared draggable
// layer). Engine-level: registered from slides/index.js for every template,
// no per-sketch code.
//
// How it fits together, mirroring the splines sketch:
//   - Item positions are stored NORMALIZED (0..1) in item.position, so a drag
//     writes resize-proof values that are saved/exported with the template.
//   - While a drag is live the moved position lives in an override map that
//     freeLayout consults when it renders (via resolveDraggedItem) — the store
//     is only written on RELEASE, so the form isn't re-rendered at 60fps.
//   - The write goes through setSketchOptions with origin "p5": the options
//     module skips its own change handler (no feedback loop) while React
//     still picks the new values up in the form.
//   - The shared draggable layer keeps the viewport pan/zoom off a drag
//     (data-no-drag + capture-phase pointerdown hit-test), so this works with
//     mouse and touch on any template without claiming `interaction.touch`.

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
// Converted to canvas-pixel space per frame (see grabRadius) so the touch
// target stays the same physical size on every device — a fixed canvas-pixel
// radius collapses to a handful of screen pixels on a phone (a 1080-wide buffer
// shown ~380px wide), which is what made items feel un-grabbable on mobile and
// let the tap fall through to a viewport pan instead.
const GRAB_RADIUS_SCREEN_PX = 44;

export const GLOBAL_CONTENT_SCOPE = "global";

export function slideContentScope( index ) {
  return `slide:${ index }`;
}

// Live drag overrides: `${scope}:${contentIndex}` → normalized { x, y }
// position. Consulted by freeLayout while a drag is in flight; flushed into
// the option store on release.
const overrides = new Map();

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
 * The item as it should render this frame: while it is being dragged, its
 * live (not yet persisted) position replaces the stored one. Called by
 * freeLayout for every content item; returns the item untouched when no drag
 * is in flight.
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

// Same wrap as slides/index.js uses to resolve the rendered slide, so the
// scope written here always matches the scope freeLayout renders with.
function currentSlideIndex( count ) {
  const raw = typeof window !== "undefined"
    ? window.getCurrentSlide?.()?.index
    : 0;
  const index = Number( raw ) || 0;

  return ( ( index % count ) + count ) % count;
}

// Every draggable content item on screen this frame, as pixel-space grab
// targets carrying where they came from (scope + index) so a move knows where
// to write back. Current slide items first, then the global list — freeLayout
// draws them in that order too.
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

function moveTarget(
  p, target, pointer
) {
  if ( !target ) {
    return;
  }

  const moved = {
    x: clamp01( pointer.x / p.width - target.marginX ),
    y: clamp01( pointer.y / p.height - target.marginY )
  };

  overrides.set(
    overrideKey(
      target.scope,
      target.index
    ),
    moved
  );

  // Keep the pixel anchor in step so a second pointer this frame can't grab
  // the item at its stale position.
  target.x = ( moved.x + target.marginX ) * p.width;
  target.y = ( moved.y + target.marginY ) * p.height;
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

// Persist the dragged positions into the saved options so they survive
// reloads and are exported with the template. Origin "p5" so the options
// module skips its own change handler (no feedback loop), while React still
// picks the new values up in the form. Overrides for a drag that is still in
// flight are flushed too (they hold the item's current position) and simply
// start accumulating again next frame.
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

// Hover / grab rings at the item anchors, mirroring the splines highlight so
// the grab handles read the same across the app.
function drawAffordance(
  p, targets, hovers, grabbed
) {
  if ( hovers.size === 0 && grabbed.size === 0 ) {
    return;
  }

  p.push();
  p.noFill();

  hovers.forEach( ( index ) => {
    const target = targets[ index ];

    if ( !target || grabbed.has( index ) ) {
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
      target.x,
      target.y,
      34
    );
  } );

  grabbed.forEach( ( index ) => {
    const target = targets[ index ];

    if ( !target ) {
      return;
    }

    p.stroke(
      120,
      200,
      255,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      target.x,
      target.y,
      40
    );
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
  } );

  p.pop();
}

function handleFrame() {
  const p = getP5();

  if ( !p ) {
    return;
  }

  const targets = collectTargets( p );

  if ( targets.length === 0 ) {
    // Nothing draggable on screen (or every item was just removed): drop any
    // in-flight drag and release the canvas affordance instead of leaving a
    // stale grab cursor behind.
    overrides.clear();
    draggable.idle();

    return;
  }

  // Keep the grab zone a constant physical size on screen: a CSS-pixel radius
  // scaled into the canvas-pixel space the drag math (and the capture-phase
  // pan-cancel hit-test) both work in.
  const grabRadius = GRAB_RADIUS_SCREEN_PX * getCanvasDisplayScale();

  const {
    hovers,
    grabbed,
    released
  } = draggable.update( {
    targets,
    radius: grabRadius,
    onMove: (
      index, pointer
    ) => moveTarget(
      p,
      targets[ index ],
      pointer
    )
  } );

  if ( released ) {
    persistOverrides();
  }

  drawAffordance(
    p,
    targets,
    hovers,
    grabbed
  );
}

/**
 * Called from slides.registerEvents() on every sketch start (the engine event
 * registry is cleared on reset). Registration order matters: slides registers
 * its render handlers first, so this post-draw runs after the content items
 * were drawn and the affordance rings stack on top.
 */
export function registerContentDrag() {
  overrides.clear();

  // The previous sketch's draggable layers (its own points AND this one) are
  // orphaned at this point — their update() will never run again, so detach
  // them before re-arming, or a stale hover flag would keep `data-no-drag` /
  // the grab cursor on the fresh canvas forever.
  detachAllDraggables();

  draggable.attach();
  events.register(
    "post-draw",
    handleFrame
  );
}
