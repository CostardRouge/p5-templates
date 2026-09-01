import badge from "../../hud/widgets/badge.js";
import boundingBox from "../../hud/widgets/boundingBox.js";
import counter from "../../hud/widgets/counter.js";
import crosshairs from "../../hud/widgets/crosshairs.js";
import gauge from "../../hud/widgets/gauge.js";
import sparkline from "../../hud/widgets/sparkline.js";
import swatch from "../../hud/widgets/swatch.js";
import {
  withinWindow
} from "../../hud/widgets/common.js";

/**
 * Standalone HUD / telemetry content-item renderer.
 *
 * Each telemetry widget is its own content-item type carrying its full style;
 * z-order among HUD elements is simply the content array order (reordering
 * layers reorders the stacking — the legacy single "hud" container forced
 * boundingBox lowest → badge on top, and its migration inserts the expanded
 * items in that order so existing scenes look identical). Widgets bind to a
 * data source (a built-in live key or a sketch-settings key-path) — see
 * hud/sources.js. Drawn via slides.render()'s post-draw pass, so recordings
 * capture them.
 */

const RENDERERS = {
  "hud-badge": badge,
  "hud-gauge": gauge,
  "hud-sparkline": sparkline,
  "hud-counter": counter,
  "hud-crosshairs": crosshairs,
  "hud-swatch": swatch,
  "hud-bounding-box": boundingBox
};

export default function drawHudElement( item ) {
  if ( !item || item.enabled === false ) {
    return;
  }

  const render = RENDERERS[ item.type ];

  if ( !render || !withinWindow( item ) ) {
    return;
  }

  // Widgets read `cfg.fill ?? style.fill` etc. — cfg IS the item now, so the
  // style object only backstops raw (unparsed) option trees missing a field.
  const style = {
    fill: item.fill ?? [
      0,
      255,
      120,
      255
    ],
    font: item.font ?? "spaceMonoRegular",
    blend: item.blend ?? "source-over",
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

  try {
    render(
      item,
      style
    );
  } catch( error ) {
    // An overlay widget must never break the sketch's render loop.
    console.warn(
      `[hud] element "${ item.type }" failed:`,
      error
    );
  }
}
