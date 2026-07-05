import string from "../../string.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  anchoredRect,
  formatValue,
  getFont,
  reportWidgetBounds,
  resolveAnchor,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Counter widget: a small label above a large value readout. The value reflects
 * its source live each frame (deterministic — no wall-clock lerp).
 */
export default function counter(
  cfg, style, part
) {
  withHudTransform( ( p ) => {
    const raw = resolveValue( cfg.source );
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const unit = cfg.unit ?? meta.unit ?? "";

    const {
      x,
      y,
      align
    } = resolveAnchor(
      p,
      cfg.anchor ?? "top-left",
      cfg.offset
    );

    const s = cfg.size ?? 28;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

    const valueText =
      typeof raw === "number"
        ? formatValue(
          raw,
          cfg.decimals ?? 0,
          unit
        )
        : `${ raw ?? "—" }`;

    // Report the visible rectangle (label above value) so the on-canvas drag
    // can grab this counter. The two lines stack from the anchor: label at the
    // top, value half a line below it.
    p.push();
    p.textFont( font );
    p.textSize( s * 0.42 );
    const labelWidth = p.textWidth( label );

    p.textSize( s );
    const valueWidth = p.textWidth( valueText );

    p.pop();

    const rect = anchoredRect(
      p,
      x,
      y,
      align,
      Math.max(
        labelWidth,
        valueWidth
      ),
      s * 1.5
    );

    reportWidgetBounds(
      part,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    string.write(
      label,
      x,
      y,
      {
        size: s * 0.42,
        font,
        fill,
        stroke: false,
        strokeWeight: 0,
        blendMode: blend,
        textWidth: -1,
        textAlign: align
      }
    );

    string.write(
      valueText,
      x,
      y + s * 0.5,
      {
        size: s,
        font,
        fill,
        stroke: false,
        strokeWeight: 0,
        blendMode: blend,
        textWidth: -1,
        textAlign: [
          align[ 0 ],
          p.TOP
        ]
      }
    );
  } );
}
