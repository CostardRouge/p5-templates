import badge from "./badge.js";
import boundingBox from "./boundingBox.js";
import counter from "./counter.js";
import crosshairs from "./crosshairs.js";
import gauge from "./gauge.js";
import sparkline from "./sparkline.js";
import swatch from "./swatch.js";

/**
 * Telemetry widget type → renderer( cfg, style ). Specs-style log/ticker
 * overlays are intentionally NOT here — use the existing `specs` content-item.
 */
const widgets = {
  badge,
  boundingBox,
  counter,
  crosshairs,
  gauge,
  sparkline,
  swatch
};

export default widgets;
