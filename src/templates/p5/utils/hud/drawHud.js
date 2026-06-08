import options from "../options.js";
import widgets, {
  SELF_TIMED
} from "./widgets/index.js";
import {
  FALLBACK_FILL,
  withinWindow
} from "./widgets/common.js";

/**
 * Draw order (later = on top). Spec logs sit above the data widgets, the badge
 * stays readable above everything.
 */
const WIDGET_ORDER = [
  "boundingBox",
  "crosshairs",
  "sparkline",
  "gauge",
  "swatch",
  "counter",
  "bootLog",
  "ticker",
  "badge"
];

/**
 * Top-level HUD draw. Reads the live, slide-aware options.sketch.hud config and
 * draws every enabled widget. A near-zero-cost no-op when the HUD is disabled,
 * so it is safe to register globally for every sketch.
 */
export default function drawHud() {
  const hud = options.sketch?.hud;

  if ( !hud?.enabled ) {
    return;
  }

  const style = {
    fill: hud.fill ?? FALLBACK_FILL,
    font: hud.font ?? "spaceMonoRegular",
    blend: hud.blend ?? "source-over"
  };

  for ( const key of WIDGET_ORDER ) {
    const cfg = hud[ key ];

    if ( !cfg?.enabled ) {
      continue;
    }

    const render = widgets[ key ];

    if ( !render ) {
      continue;
    }

    if ( !SELF_TIMED.has( key ) && !withinWindow( cfg ) ) {
      continue;
    }

    try {
      render(
        cfg,
        style
      );
    } catch( error ) {
      // An overlay widget must never break the sketch's render loop.
      console.warn(
        `[hud] widget "${ key }" failed:`,
        error
      );
    }
  }
}
