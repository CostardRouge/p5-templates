/**
 * Window event dispatched (e.g. by the engine controls record shortcut) to
 * open the mobile studio drawer on its Export tab. Lives in its own module so
 * importers don't pull the whole drawer subtree into their bundle.
 */
export const OPEN_EXPORT_DRAWER_EVENT = "studio:open-export-drawer";

/**
 * Window event dispatched by the on-canvas content-item drag (contentDrag.js)
 * when an item is pressed/grabbed, so the options panel can reveal that item's
 * form section — open its zone (global content / the right slide), open the
 * item, scroll it into view and pulse it. The `detail` mirrors the drag target:
 * `{ scope: "global" | "slide:<n>", index: number | "montage-title", part }`.
 * The literal is duplicated (not imported) in contentDrag.js — keep them in
 * sync, the same way syncSketchOptions' "sketch-options" twin is.
 */
export const CONTENT_ITEM_SELECT_EVENT = "studio:content-item-select";

/**
 * Root-level CSS variable holding the rendered height of the open mobile
 * drawer (0 when collapsed or on desktop). The sketch viewport subtracts it
 * from its own height so fit-to-viewport targets the visible area above the
 * drawer.
 */
export const STUDIO_DRAWER_HEIGHT_VAR = "--studio-drawer-height";
