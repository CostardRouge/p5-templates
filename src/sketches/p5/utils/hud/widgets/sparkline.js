import string from "../../string.js";
import {
  pushHistory,
  series
} from "../history.js";
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
 * Sparkline widget: plots a source's recent history (from the frame-keyed ring
 * buffer it feeds itself) as a polyline, with the label + current value above.
 */
export default function sparkline(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const current = resolveValue( cfg.source );

    // Feed our own history buffer (frame-keyed, recording-safe).
    pushHistory(
      cfg.source,
      current
    );

    const s = cfg.size ?? 16;
    const boxW = s * 11;
    const boxH = s * 4;
    const blockH = s + s * 0.4 + boxH;

    const {
      blockX,
      blockY
    } = resolveBlock(
      p,
      cfg.anchor ?? "bottom-right",
      cfg.offset,
      boxW,
      blockH
    );

    // Report the visible rectangle so the on-canvas drag can grab this sparkline.
    reportWidgetBounds(
      blockX,
      blockY,
      boxW,
      blockH
    );

    paintWidgetBackground(
      style,
      blockX,
      blockY,
      boxW,
      blockH,
      s
    );

    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const frame = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      60
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

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

    if ( typeof current === "number" ) {
      string.write(
        formatValue(
          current,
          cfg.decimals ?? 0,
          cfg.unit ?? meta.unit ?? ""
        ),
        blockX + boxW,
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
    }

    const plotY = blockY + s + s * 0.4;
    const points = series( cfg.source );
    const limit = cfg.historySize ?? points.length;
    const data = points.slice( Math.max(
      0,
      points.length - limit
    ) );

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    p.noFill();
    p.stroke( frame );
    p.strokeWeight( 1 );
    p.rect(
      blockX,
      plotY,
      boxW,
      boxH
    );

    if ( data.length >= 2 ) {
      const min = cfg.min ?? Math.min( ...data );
      const max = cfg.max ?? Math.max( ...data );
      const span = max - min || 1;

      p.stroke( fill );
      p.strokeWeight( Math.max(
        1,
        s * 0.08
      ) );
      p.noFill();
      p.beginShape();

      for ( let i = 0; i < data.length; i++ ) {
        const px = blockX + ( i / ( data.length - 1 ) ) * boxW;
        const py = plotY + boxH - p.constrain(
          ( data[ i ] - min ) / span,
          0,
          1
        ) * boxH;

        p.vertex(
          px,
          py
        );
      }

      p.endShape();
    }

    p.pop();
  } );
}
