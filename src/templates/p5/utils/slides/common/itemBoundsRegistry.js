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
// freeLayout brackets each item render with beginItemBounds(scope, index) /
// endItemBounds(), and each renderer reports the rectangle it actually drew
// (canvas-pixel space) via reportItemBounds(). Entries carry the frame they
// were reported on so a consumer can ignore stale rects (item removed,
// renderer bailed early).

const registry = new Map(); // "scope:index[:part]" → { x, y, w, h, frame, order }

let currentKey = null;
let drawOrder = 0;

// A `part` addresses a positioned sub-item WITHIN a content item — a HUD widget
// (badge, gauge, …) whose own `offset` places it independently of the item.
// Whole-item bounds omit it; sub-item bounds append it as a third segment.
export function itemBoundsKey(
  scope, index, part
) {
  const base = `${ scope }:${ index }`;

  return part == null ? base : `${ base }:${ part }`;
}

/** Called by freeLayout before dispatching one item's renderer. */
export function beginItemBounds(
  scope, index
) {
  currentKey = scope == null ? null : itemBoundsKey(
    scope,
    index
  );
}

/** Called by freeLayout after the renderer returns. */
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
 * Called by a sub-item renderer (a HUD widget) with the rectangle it just drew,
 * in canvas pixels, tagged with its `part` key. Registers under the current
 * item's `scope:index:part`, so the drag layer can hit-test and move that one
 * widget independently. No-op outside a begin/endItemBounds bracket.
 */
export function reportItemPartBounds(
  part, x, y, w, h
) {
  if ( !currentKey || part == null || ![
    x,
    y,
    w,
    h
  ].every( Number.isFinite ) ) {
    return;
  }

  registry.set(
    `${ currentKey }:${ part }`,
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
  scope, index, part, maxAge = 3
) {
  const entry = registry.get( itemBoundsKey(
    scope,
    index,
    part
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
