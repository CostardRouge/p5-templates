import {
  drawSpecsWidget
} from "./specsAdapter.js";

/**
 * Boot-log widget: streams the current sketch specs in top-down with a
 * per-character typewriter and blinking cursor. Reuses drawSlideSpecs.
 */
export default function bootLog(
  cfg, style
) {
  drawSpecsWidget(
    cfg,
    style,
    "boot-log"
  );
}
