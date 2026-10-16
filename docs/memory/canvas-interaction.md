# On-canvas interaction — grabbing and moving content items, panning and zooming the viewport

Read before touching `src/sketches/p5/utils/slides/contentDrag.js`, the item-bounds registry, any `drawSlide*` renderer's grab surface, or the viewport's gesture recognisers (`src/components/ScalableViewport/hooks/useViewportGestures.ts`). The studio-side half of the same channel (the layers list, the inspector it opens) is in `studio-ui.md`.

## A mouse wheel zooms, a trackpad scroll pans, a pinch zooms (2026-09-01, revised 2026-10-16)

Decided with the maintainer on 2026-09-01: a two-finger trackpad scroll must pan the viewport, never zoom it — it used to, because every plain wheel event zoomed. That fix made EVERY plain wheel pan, so a mouse lost its zoom (ctrl+scroll only), which the maintainer reported as a regression on 2026-10-16: **the mouse wheel zooms about the cursor again, the trackpad scroll still pans**, and pinching (touch, or a trackpad pinch = ctrl+wheel) still zooms. Both arrive as plain wheel events, so `isMouseWheelEvent` tells them apart: `deltaMode` 1 (Firefox's lines) is a wheel; any `deltaX` is two fingers; in Chromium / WebKit a wheel notch's legacy `wheelDeltaY` is ±120 while a trackpad's is exactly −3 × its pixel `deltaY` (within 1.5, for page-zoom rounding); anything unclassifiable pans, the safe old behaviour. **The first plain event of a burst decides** (`wheelMode` ref, cleared on the wheel recogniser's end), so a trackpad's momentum tail can never flip into a zoom halfway. The zoom factor is the pre-2026-09 one, `exp( -deltaY * 0.01 )` (`WHEEL_ZOOM_PER_PIXEL`): a Chromium notch (`deltaY` 100) is ×e — headless Chromium hands the page `deltaY -100, wheelDeltaY 120` for `mouse.wheel( 0, -100 )`, verified in the studio (0.556 → 1.513 and back exactly). Not verifiable here: a real trackpad's events, and a macOS mouse's in Safari — if one pans when it should zoom (or the reverse), log its `deltaMode / deltaX / deltaY / wheelDeltaY` and adjust the classifier, not the gestures. Mechanics that make the split hold, all in `useViewportGestures.ts`:

- Browsers deliver a trackpad pinch as a **wheel event with `ctrlKey`**; `@use-gesture`'s pinch recogniser claims those (`pinchOnWheel`, default on, keyed on `modifierKey`, set explicitly to `PINCH_WHEEL_MODIFIER`). Its **wheel recogniser still receives every wheel event**, modifier or not — so the wheel handlers must skip `isPinchWheelEvent( event )` themselves, or the ctrl+wheel zoom is applied twice and the pause/resume interaction callbacks of both recognisers interleave.
- Because the wheel recogniser's start/end fire for the pinch's events too, the "panning" / "zooming" interaction is opened by the first *plain* wheel event inside `onWheel` (the `wheelMode` ref), not in `onWheelStart`, and `onWheelEnd` only closes it when it was opened. Otherwise a pinch would pause and resume the engine through the wheel path as well.
- Pan direction follows natural scrolling: the content moves with the fingers (`x - deltaX`, `y - deltaY`); use-gesture already normalises line/page `deltaMode`.
- Guarded by `hooks/__tests__/useViewportGestures.test.tsx` (jsdom wheel events with and without `ctrlKey`, mouse- and trackpad-shaped ones, fake timers for the recognisers' settle timeout). jsdom's `WheelEvent` has no `wheelDeltaY`: the tests define it on the event. The pinch handler stores its memo on its first event and writes the transform from the second, so a wheel-pinch test needs two events.

## There is no pluggable "layout mode" — never re-add one without checking here first (2026-09-01)

`src/sketches/p5/utils/slides/layouts/` used to hold a `_layouts` registry (`auto`, `free`, `full`, `strip`, `split`, `grid2x2`, `polaroid`) meant to be selected per-slide via a `source?.layout` field — but that selector was always commented out in `slides/index.js`, no `layout` field ever existed in `SlideSchema`/`OptionsSchema`, and no UI ever offered a mode picker. Only `free` (i.e. `freeLayout`) ever ran; the other six implementations (`autoLayout` + five `image*Layout.js` files) were unreachable from day one. Removed as dead scaffolding: `freeLayout`'s per-item dispatch loop (the `switch` over content-item types, bracketed by `beginItemBounds`/`endItemBounds`) now lives directly in `slides.render()` in `slides/index.js` — there is no separate "layout" file or concept left, just the one content-render loop. If a future need for multiple slide layouts shows up, design it against real requirements rather than resurrecting this registry; it was cut, not paused.

## An item is draggable only when three things line up (2026-08-31)

`contentDrag.js` owns raw capture-phase pointer events on `window` and hit-tests every press before the viewport's pan recogniser sees it. For a content item to be grabbable, all three must hold:

1. its `type` is in `DRAGGABLE_TYPES`;
2. its anchor is resolved the way its renderer resolves it — `positionDefaults( type )` must mirror the schema's own `position` default, and a type whose renderer offsets the anchor by the item's margins must be in `MARGIN_ANCHORED_TYPES` (`text`, `title`: `string.write` draws them at `(margin + position) * size`);
3. its renderer reports the rectangle it actually drew, through `reportItemBounds` inside `slides.render()`'s (`slides/index.js`) `begin/endItemBounds` bracket.

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

## A right-click on an item can open a canvas menu (2026-10-10)

`contentDrag.js` also listens to `contextmenu` (window, capture): when the hit item's type is in `ITEM_MENU_TYPES` (today only `hud-vector3d`), it prevents the browser menu, emits the usual select event and `studio:content-item-menu` (`CONTENT_ITEM_MENU_EVENT`, duplicated literal) with scope, index, type and client coordinates; `CanvasItemMenu` (mounted in `SketchOptions`, inside the form) answers it with `FieldContextMenu` and writes through `setValue`, so the edit reaches the sketch, the inspector and undo like a field edit. Anything else — another item type, empty canvas — keeps the browser's menu. Left press stays the drag; the menu is right-click only by the maintainer's choice. Adding a menu to another type: one entry in `ITEM_MENU_TYPES` plus a branch in `CanvasItemMenu`. Offset targets now carry `type` for this.
