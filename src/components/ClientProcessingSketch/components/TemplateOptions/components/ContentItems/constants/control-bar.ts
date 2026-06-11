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
