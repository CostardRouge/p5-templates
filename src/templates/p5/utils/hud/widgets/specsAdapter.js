import drawSlideSpecs from "../../slides/common/drawSlideSpecs.js";

/**
 * Build a specsOption from a HUD widget config and delegate to the existing
 * drawSlideSpecs renderer (boot-log / ticker). This keeps the log widgets in
 * lockstep with the slides "specs" overlay instead of duplicating its logic.
 *
 * drawSlideSpecs manages its own reveal → hold → fade timeline (driven by
 * animation.progression), so these widgets are self-timed and not gated by the
 * shared display window.
 */
export function drawSpecsWidget(
  cfg, style, fallbackStyle
) {
  drawSlideSpecs( {
    style: cfg.style ?? fallbackStyle,
    fill: cfg.fill ?? style.fill,
    font: cfg.font ?? style.font,
    blend: cfg.blend ?? style.blend,
    size: cfg.size ?? 22,
    lineHeight: cfg.lineHeight ?? 1.4,
    showCursor: cfg.showCursor ?? true,
    includeSketchSettings: cfg.includeSketchSettings ?? false,
    position: {
      x: cfg.offset?.x ?? 0.05,
      y: cfg.offset?.y ?? 0.06
    },
    revealEnd: cfg.revealEnd ?? 0.45,
    holdEnd: cfg.holdEnd ?? 0.7,
    fadeEnd: cfg.fadeEnd ?? 0.85
  } );
}
