import badge from "./badge.js";
import bootLog from "./bootLog.js";
import boundingBox from "./boundingBox.js";
import counter from "./counter.js";
import crosshairs from "./crosshairs.js";
import gauge from "./gauge.js";
import sparkline from "./sparkline.js";
import swatch from "./swatch.js";
import ticker from "./ticker.js";

/**
 * Widget type → renderer( cfg, style ).
 */
const widgets = {
  badge,
  bootLog,
  boundingBox,
  counter,
  crosshairs,
  gauge,
  sparkline,
  swatch,
  ticker
};

/**
 * Widgets that manage their own reveal/hold/fade timeline and must NOT be gated
 * by the shared display window.
 */
export const SELF_TIMED = new Set( [
  "bootLog",
  "ticker"
] );

export default widgets;
