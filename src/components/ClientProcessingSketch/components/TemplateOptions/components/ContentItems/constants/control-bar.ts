/**
 * Shared chrome for the one-line form controls (slider, color, easing,
 * select…) so every control has the same height, radius, typography and
 * spacing on both mobile (finger-sized) and desktop (compact).
 */
export const CONTROL_BAR_CLASS =
  "relative flex h-10 md:h-7 w-full items-center overflow-hidden rounded-lg border border-theme bg-background";

/** Label segment pinned to the left edge of a segmented control bar. */
export const CONTROL_LABEL_SEGMENT_CLASS =
  "flex h-full max-w-[50%] shrink-0 items-center gap-1 border-r border-theme bg-foreground/5 px-2.5";

/** Inline reset affordance shown when a field differs from its saved value. */
export const CONTROL_RESET_BUTTON_CLASS =
  "pointer-events-auto p-1.5 md:p-0.5 rounded-md text-label hover:text-foreground hover:bg-hover transition-colors";

/** Tappable value readout that switches the bar to precise numeric entry. */
export const CONTROL_VALUE_BUTTON_CLASS =
  "pointer-events-auto px-1.5 py-1 md:py-0.5 rounded-md font-mono tabular-nums text-foreground/80 hover:text-foreground hover:bg-hover transition-colors";

/** Numeric input that temporarily replaces a bar while editing its value. */
export const CONTROL_EDIT_INPUT_CLASS =
  "w-full h-10 md:h-7 px-2.5 border border-theme rounded-lg bg-background text-foreground text-center font-mono text-base md:text-xs focus:outline-none focus:ring-1 focus:ring-focus";

/** Chevron displayed in select-like controls. */
export const CONTROL_CHEVRON_CLASS =
  "h-4 w-4 md:h-3 md:w-3 shrink-0 text-label";

/** Borderless input filling the free segment of a control bar. */
export const CONTROL_BAR_INPUT_CLASS =
  "h-full min-w-0 flex-1 bg-transparent px-2.5 text-base md:text-xs text-foreground placeholder:text-label/70 focus:outline-none";

/**
 * Card chrome for multi-line controls (textarea, json, multi-select): same
 * border/radius as the bars, with a label header strip on top.
 */
export const CONTROL_CARD_CLASS =
  "overflow-hidden rounded-lg border border-theme bg-background focus-within:ring-1 focus-within:ring-focus";

/** Header strip of a control card, mirroring the bar label segment. */
export const CONTROL_CARD_HEADER_CLASS =
  "flex items-center justify-between gap-1 border-b border-theme bg-foreground/5 px-2.5 py-1.5 md:py-1";

/** Borderless textarea body inside a control card. */
export const CONTROL_CARD_TEXTAREA_CLASS =
  "block w-full resize-y bg-transparent px-2.5 py-2 md:px-1.5 md:py-1 text-base md:text-xs text-foreground placeholder:text-label/70 focus:outline-none";
