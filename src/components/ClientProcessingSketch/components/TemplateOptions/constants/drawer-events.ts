/**
 * Window event dispatched (e.g. by the engine controls record shortcut) to
 * open the mobile studio drawer on its Export tab. Lives in its own module so
 * importers don't pull the whole drawer subtree into their bundle.
 */
export const OPEN_EXPORT_DRAWER_EVENT = "studio:open-export-drawer";

/**
 * Root-level CSS variable holding the rendered height of the open mobile
 * drawer (0 when collapsed or on desktop). The sketch viewport subtracts it
 * from its own height so fit-to-viewport targets the visible area above the
 * drawer.
 */
export const STUDIO_DRAWER_HEIGHT_VAR = "--studio-drawer-height";
