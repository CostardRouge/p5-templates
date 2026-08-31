# On-canvas interaction — grabbing and moving content items

Read before touching `src/sketches/p5/utils/slides/contentDrag.js`, the item-bounds registry, or any `drawSlide*` renderer's grab surface. The studio-side half of the same channel (the layers list, the inspector it opens) is in `studio-ui.md`.

## An item is draggable only when three things line up (2026-08-31)

`contentDrag.js` owns raw capture-phase pointer events on `window` and hit-tests every press before the viewport's pan recogniser sees it. For a content item to be grabbable, all three must hold:

1. its `type` is in `DRAGGABLE_TYPES`;
2. its anchor is resolved the way its renderer resolves it — `positionDefaults( type )` must mirror the schema's own `position` default, and a type whose renderer offsets the anchor by the item's margins must be in `MARGIN_ANCHORED_TYPES` (`text`, `title`: `string.write` draws them at `(margin + position) * size`);
3. its renderer reports the rectangle it actually drew, through `reportItemBounds` inside `freeLayout`'s `begin/endItemBounds` bracket.

Miss (1) and the item is inert — that is what kept `title` un-draggable for its whole life even though its renderer already reported bounds. Miss (3) and it falls back to a 44-screen-px disc at its anchor, which is fine for `visual` (nothing measurable to report) and is deliberately kept for every type, because it is also what lets you move an item the current frame does not draw — a `title` outside its `displayFrom..displayTo` window would otherwise be repositionable during only 20% of the loop.

**Adding a positioned content type means editing all three places, not just the schema.** A drag test in `slides/__tests__/contentDrag.test.ts` (mock the bounds, press, move, release, assert the persisted position) is the cheap guard.

## Rect-mode text must report its GLYPHS, never its layout box (2026-08-31)

`string.write` lays text out inside a rectangle that is the whole canvas minus the item's margins, and aligns the glyphs *inside* it. Reporting that box as the grab surface hands the item a near-full-canvas rectangle that swallows every press meant for another item or for the viewport pan — the second reason `title` was not usable even after being listed. Both text-shaped items (`text`, `title`) resolve their rectangle through `common/textItemBounds.js`; a multi-line string measures as one over-wide, one-line-tall run through `font.textBounds`, so that helper takes a per-line `measureLine` and stacks the lines (the default title is the sketch name broken on hyphens — always multi-line).

## The affordance says two different things (2026-08-31)

The outline is **what a press picks up** (the drawn rectangle, or the pick-up disc when nothing was reported). The anchor marker — crosshair in a ring, plus a leader line when it falls outside the rectangle — is **what the inspector's `position` numbers mean**. They are usually far apart: a fresh text item at `position.x = 0` draws mid-canvas with its anchor on the left edge. Both are drawn on hover, not only while dragging; that is the point (asked for by the maintainer, 2026-08-31). Marker geometry is sized in **screen** pixels via `getCanvasDisplayScale()`, like the pick-up radius — a fixed canvas-pixel size collapses to a few pixels on a phone.

## What is deliberately not draggable

- `background` — fills the canvas, has no position.
- `meta` — four corner labels, each pinned to its corner by design; the schema carries no per-corner position, and giving it one would turn a "corner metadata overlay" into four loose texts.
- HUD `crosshairs` (placed by its data source) and `boundingBox` (a region rect); the five offset-anchored widgets are each their own grab target.
- A `breakdown` with `placement: "roaming"` — it ignores `item.position` entirely, so it is excluded *before* the hit-test, or the anchor-disc fallback would grab it at a position it never uses.
