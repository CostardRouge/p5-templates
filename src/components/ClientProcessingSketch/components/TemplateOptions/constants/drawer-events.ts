/**
 * Window event dispatched (e.g. by the engine controls record shortcut) to
 * open the mobile studio drawer on its Export tab. Lives in its own module so
 * importers don't pull the whole drawer subtree into their bundle.
 */
export const OPEN_EXPORT_DRAWER_EVENT = "studio:open-export-drawer";
