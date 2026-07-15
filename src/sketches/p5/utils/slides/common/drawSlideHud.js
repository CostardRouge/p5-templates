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
 * freeLayout's post-draw pass, so it is captured by recordings.
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
    blend: item.blend ?? "source-over",
    // Shared background panel painted behind each boxed widget's readout.
    // Transparent by default (draws nothing); see paintWidgetBackground.
    background: item.backgroundColor ?? [
      0,
      0,
      0,
      0
    ],
    backgroundStroke: item.backgroundStroke ?? [
      0,
      0,
      0,
      0
    ],
    backgroundRadius: item.backgroundRadius ?? 0
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
        style,
        key
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
