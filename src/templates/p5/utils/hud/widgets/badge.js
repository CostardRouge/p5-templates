import string from "../../string.js";
import {
  resolveValue
} from "../sources.js";
import {
  getFont,
  resolveAnchor,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Badge widget: a compact "resolution · fps" readout. During recording the fps
 * is the target framerate (deterministic); live it shows the measured rate.
 */
export default function badge(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const {
      x,
      y,
      align
    } = resolveAnchor(
      p,
      cfg.anchor ?? "top-right",
      cfg.offset
    );

    const size = cfg.size ?? 20;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const font = getFont( cfg.font ?? style.font );
    const text = `${ resolveValue( "resolution" ) }  ·  ${ resolveValue( "fps" ) } FPS`;

    string.write(
      text,
      x,
      y,
      {
        size,
        font,
        fill,
        stroke: false,
        strokeWeight: 0,
        blendMode: cfg.blend ?? style.blend,
        textWidth: -1,
        textAlign: align
      }
    );
  } );
}
