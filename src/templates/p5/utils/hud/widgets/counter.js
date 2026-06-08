import string from "../../string.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  formatValue,
  getFont,
  resolveAnchor,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Counter widget: a small label above a large value readout. The value reflects
 * its source live each frame (deterministic — no wall-clock lerp).
 */
export default function counter(
  cfg, style
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
