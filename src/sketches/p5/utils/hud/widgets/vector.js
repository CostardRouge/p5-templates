import string from "../../string.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  getFont,
  paintWidgetBackground,
  reportWidgetBounds,
  resolveBlock,
  toColor,
  toPoint,
  withHudTransform
} from "./common.js";
import {
  vectorCoordinatesText,
  vectorFractions
} from "../vectorMap.js";

/**
 * Vector widget: a point plotted on a mini x/y map, the on-canvas counterpart
 * of the vector2d pad the parameter is edited with.
 *
 * Two settings carry the whole design:
 *  - `space` says what the source's numbers mean — the parameter's own units,
 *    plotted over [min, max], or canvas pixels, plotted over the canvas. One
 *    widget therefore maps a normalized sketch vector and the pixel-space
 *    built-ins (mouse / center) without a second type.
 *  - `coordinates` says which pair is printed: "relative" (parameter units,
 *    what the pad shows) or "absolute" (where the point lands on the canvas,
 *    in pixels). They are two readings of one position, so switching between
 *    them never moves the dot.
 */
export default function vector(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const point = toPoint( resolveValue( cfg.source ) );

    if ( !point ) {
      return;
    }

    const s = cfg.size ?? 16;
    const box = s * 6;
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const coordinates = cfg.coordinates ?? "relative";
    const readoutSize = s * 0.8;

    const labelHeight = label ? s * 1.35 : 0;
    const readoutHeight = coordinates === "none" ? 0 : readoutSize * 1.5;
    const blockHeight = labelHeight + box + readoutHeight;

    const {
      blockX,
      blockY
    } = resolveBlock(
      p,
      cfg.anchor ?? "bottom-right",
      cfg.offset,
      box,
      blockHeight
    );

    reportWidgetBounds(
      blockX,
      blockY,
      box,
      blockHeight
    );

    paintWidgetBackground(
      style,
      blockX,
      blockY,
      box,
      blockHeight,
      s
    );

    // The position as a 0..1 fraction of the domain — what drives the plot, and
    // what both printed readings are derived from (see vectorMap.js).
    const {
      fx, fy
    } = vectorFractions(
      point,
      cfg,
      p
    );

    const plotX = blockX + p.constrain(
      fx,
      0,
      1
    ) * box;
    const plotFy = p.constrain(
      fy,
      0,
      1
    );
    const boxY = blockY + labelHeight;
    const plotY = boxY + ( cfg.yDown === false ? 1 - plotFy : plotFy ) * box;

    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const frame = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      110
    );
    const guide = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      55
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    p.noFill();
    p.strokeWeight( 1 );

    // The map: a frame, a faint centre cross for reference, and the point's own
    // guides running out to the edges — the pad's own vocabulary.
    p.stroke( guide );
    p.line(
      blockX,
      boxY + box / 2,
      blockX + box,
      boxY + box / 2
    );
    p.line(
      blockX + box / 2,
      boxY,
      blockX + box / 2,
      boxY + box
    );

    p.stroke( frame );
    p.rect(
      blockX,
      boxY,
      box,
      box
    );
    p.line(
      blockX,
      plotY,
      blockX + box,
      plotY
    );
    p.line(
      plotX,
      boxY,
      plotX,
      boxY + box
    );

    p.noStroke();
    p.fill( fill );
    p.circle(
      plotX,
      plotY,
      s * 0.5
    );
    p.pop();

    if ( label ) {
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
    }

    const text = vectorCoordinatesText(
      point,
      cfg,
      p
    );

    if ( text === null ) {
      return;
    }

    string.write(
      text,
      blockX,
      boxY + box + readoutSize * 0.4,
      {
        size: readoutSize,
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
  } );
}
