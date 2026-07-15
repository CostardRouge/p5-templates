import string from "../../string.js";
import easing from "../../easing.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  formatValue,
  getFont,
  paintWidgetBackground,
  reportWidgetBounds,
  resolveBlock,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Gauge widget: a labelled bar showing a numeric value mapped over [min, max],
 * with the current value printed at the right. The fill fraction is truthful
 * (linear) by default; an optional easingFn restyles it.
 */
export default function gauge(
  cfg, style, part
) {
  withHudTransform( ( p ) => {
    const raw = resolveValue( cfg.source );
    const value = typeof raw === "number" ? raw : 0;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const unit = cfg.unit ?? meta.unit ?? "";

    const s = cfg.size ?? 18;
    const barW = s * 11;
    const barH = s * 0.7;
    const blockH = s + s * 0.4 + barH;

    const {
      blockX,
      blockY
    } = resolveBlock(
      p,
      cfg.anchor ?? "bottom-left",
      cfg.offset,
      barW,
      blockH
    );

    // Report the visible rectangle so the on-canvas drag can grab this gauge.
    reportWidgetBounds(
      part,
      blockX,
      blockY,
      barW,
      blockH
    );

    paintWidgetBackground(
      style,
      blockX,
      blockY,
      barW,
      blockH,
      s
    );

    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const track = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      60
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

    const t = p.constrain(
      p.map(
        value,
        min,
        max,
        0,
        1
      ),
      0,
      1
    );
    const easeFn = easing[ cfg.easingFn ] ?? easing.linear;
    const filled = easeFn( t );

    string.write(
      label,
      blockX,
      blockY,
      {
        size: s,
        font,
        fill,
        stroke: false,
        strokeWeight: 0,
        blendMode: blend,
        textWidth: -1,
        textAlign: [
          p.LEFT,
          p.TOP
        ]
      }
    );

    string.write(
      formatValue(
        value,
        cfg.decimals ?? 0,
        unit
      ),
      blockX + barW,
      blockY,
      {
        size: s,
        font,
        fill,
        stroke: false,
        strokeWeight: 0,
        blendMode: blend,
        textWidth: -1,
        textAlign: [
          p.RIGHT,
          p.TOP
        ]
      }
    );

    const barY = blockY + s + s * 0.4;

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    p.noStroke();
    p.fill( track );
    p.rect(
      blockX,
      barY,
      barW,
      barH
    );
    p.fill( fill );
    p.rect(
      blockX,
      barY,
      barW * filled,
      barH
    );
    p.pop();
  } );
}
