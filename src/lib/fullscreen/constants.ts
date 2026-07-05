/**
 * Sentinel value used by the canvas-size select to represent the "Fullscreen"
 * choice. It is not a `WIDTHxHEIGHT` preset — picking it drives the browser's
 * Fullscreen API instead of writing a fixed size (see `fullscreenViewport.ts`).
 */
export const FULLSCREEN_PRESET_VALUE = "fullscreen";

/** Human-readable label shown for the fullscreen entry in the size select. */
export const FULLSCREEN_PRESET_LABEL = "Fullscreen";
