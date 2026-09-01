import {
  getP5
} from "../../sketch.js";

// ── Per-frame registry of where each content item was ACTUALLY drawn ───────
// The on-canvas drag (slides/contentDrag.js) originally hit-tested a small
// disc around an item's normalized `position` anchor. But an item's anchor is
// often nowhere near its visible pixels — rect-mode text centers its glyphs
// inside a near-full-width layout box, images extend around their anchor, and
// a freshly added text item (position.x = 0) draws in the middle of the
// canvas while its anchor sits on the left edge. Grabbing "what you see"
// (the way splines-v2-draggable works, where the visible dots ARE the
// anchors) requires knowing the drawn rectangle.
//
// slides.render() (slides/index.js) brackets each item render with
// beginItemBounds(scope, index) / endItemBounds(), and each renderer reports
// the rectangle it actually drew
// (canvas-pixel space) via reportItemBounds(). Entries carry the frame they
// were reported on so a consumer can ignore stale rects (item removed,
// renderer bailed early).

const registry = new Map(); // "scope:index" → { x, y, w, h, frame, order }

let currentKey = null;
let drawOrder = 0;

export function itemBoundsKey(
  scope, index
) {
  return `${ scope }:${ index }`;
}

/** Called by slides.render() before dispatching one item's renderer. */
export function beginItemBounds(
  scope, index
) {
  currentKey = scope == null ? null : itemBoundsKey(
    scope,
    index
  );
}

/** Called by slides.render() after the renderer returns. */
export function endItemBounds() {
  currentKey = null;
}

/**
 * Called by a renderer with the rectangle it just drew, in canvas pixels.
 * No-op outside a beginItemBounds/endItemBounds bracket, so renderers can
 * report unconditionally (they are also used outside content-item rendering).
 */
export function reportItemBounds(
  x, y, w, h
) {
  if ( !currentKey || ![
    x,
    y,
    w,
    h
  ].every( Number.isFinite ) ) {
    return;
  }

  registry.set(
    currentKey,
    {
      x,
      y,
      w,
      h,
      frame: getP5()?.frameCount ?? 0,
      order: drawOrder++
    }
  );
}

/**
 * The rectangle an item was last drawn at, or null when none was reported
 * recently (renderer bailed, item removed, sketch not yet drawn). `maxAge`
 * is in frames; a noLoop sketch doesn't advance frameCount, so its last
 * report stays valid.
 */
export function getItemBounds(
  scope, index, maxAge = 3
) {
  const entry = registry.get( itemBoundsKey(
    scope,
    index
  ) );

  if ( !entry ) {
    return null;
  }

  const frame = getP5()?.frameCount ?? 0;

  if ( frame - entry.frame > maxAge ) {
    return null;
  }

  return entry;
}

/** Fresh-start hook for sketch (re)initialisation. */
export function clearItemBounds() {
  registry.clear();
  currentKey = null;
  drawOrder = 0;
}
