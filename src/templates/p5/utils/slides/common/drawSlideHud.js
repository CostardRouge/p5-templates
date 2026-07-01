import widgets from "../../hud/widgets/index.js";
import {
  withinWindow
} from "../../hud/widgets/common.js";

/**
 * HUD / telemetry content-item renderer.
 *
 * A single "hud" content-item holds one slot per telemetry widget (badge,
 * gauge, sparkline, counter, crosshairs, swatch, boundingBox), each toggled and
 * configured independently. Widgets bind to a data source (a built-in live key
 * or a sketch-settings key-path) — see hud/sources.js. Drawn on the canvas via
 * freeLayout (post-draw for "front" items, pre-draw for "back" items placed
 * behind the sketch), so it is captured by recordings either way. Note a
 * "back" HUD only shows where the sketch leaves transparency, unless the
 * template sets sketch.delegateBackground.
 */

// Draw order (later = on top).
const WIDGET_ORDER = [
  "boundingBox",
  "crosshairs",
  "sparkline",
  "gauge",
  "swatch",
  "counter",
  "badge"
];

export default function drawSlideHud( item ) {
  if ( !item ) {
    return;
  }

  const style = {
    fill: item.fill ?? [
      0,
      255,
      120,
      255
    ],
    font: item.font ?? "spaceMonoRegular",
    blend: item.blend ?? "source-over"
  };

  for ( const key of WIDGET_ORDER ) {
    const cfg = item[ key ];

    if ( !cfg?.enabled ) {
      continue;
    }

    const render = widgets[ key ];

    if ( !render || !withinWindow( cfg ) ) {
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
