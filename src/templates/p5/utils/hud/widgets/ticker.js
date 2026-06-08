import {
  drawSpecsWidget
} from "./specsAdapter.js";

/**
 * Ticker widget: a single line cycling through the sketch spec parameters.
 * Reuses drawSlideSpecs in "ticker" mode.
 */
export default function ticker(
  cfg, style
) {
  drawSpecsWidget(
    cfg,
    style,
    "ticker"
  );
}
