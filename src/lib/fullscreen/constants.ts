/**
 * Fullscreen comes in two flavours, surfaced both in the canvas-size select and
 * the zoom-controls hover menu:
 *
 * - `hud`  — fullscreen that keeps the sketch's on-canvas UI around it (title,
 *            progression slider, FPS counter, zoom controls). The canvas keeps
 *            its own resolution and is fit into the screen.
 * - `bare` — a "true" fullscreen: only the canvas, stretched to the screen's
 *            resolution, with none of the surrounding UI (and no hover outline).
 *
 * These sentinel values are not `WIDTHxHEIGHT` presets — the size select and the
 * zoom controls recognise them and drive the browser Fullscreen API instead (see
 * fullscreenViewport.ts).
 */
export type FullscreenMode = "hud" | "bare";

export type FullscreenPreset = {
  value: string;
  label: string;
  mode: FullscreenMode;
};

export const FULLSCREEN_PRESETS: FullscreenPreset[] = [
  {
    value: "fullscreen-hud",
    label: "Fullscreen",
    mode: "hud"
  },
  {
    value: "fullscreen-bare",
    label: "Fullscreen (fill screen)",
    mode: "bare"
  }
];

export const FULLSCREEN_PRESET_VALUES = FULLSCREEN_PRESETS.map( ( preset ) => preset.value );

export function isFullscreenFormatValue( value: string | number | null | undefined ): boolean {
  return typeof value === "string" && FULLSCREEN_PRESET_VALUES.includes( value );
}

export function fullscreenModeForValue( value: string | number | null | undefined ): FullscreenMode | null {
  return FULLSCREEN_PRESETS.find( ( preset ) => preset.value === value )?.mode ?? null;
}

export function fullscreenValueForMode( mode: FullscreenMode | null ): string | null {
  return FULLSCREEN_PRESETS.find( ( preset ) => preset.mode === mode )?.value ?? null;
}
