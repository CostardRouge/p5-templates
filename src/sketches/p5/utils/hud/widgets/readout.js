import string from "../../string.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  anchoredRect,
  getFont,
  paintWidgetBackground,
  reportWidgetBounds,
  resolveAnchor,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Print any resolved value as telemetry text. Booleans read ON / OFF rather
 * than "true" / "false" (this is a panel, not a JSON dump), numbers are
 * trimmed of float noise, and an absent value prints an em dash instead of
 * "undefined". Arrays and points are joined, so a readout bound to a colour or
 * a vector still says something useful.
 */
export function displayText( value ) {
  if ( value === null || value === undefined || value === "" ) {
    return "—";
  }

  if ( typeof value === "boolean" ) {
    return value ? "ON" : "OFF";
  }

  if ( typeof value === "number" ) {
    return Number.isFinite( value )
      ? String( Math.round( value * 10000 ) / 10000 )
      : "—";
  }

  if ( Array.isArray( value ) ) {
    return value.map( displayText )
      .join( ", " );
  }

  if ( typeof value === "object" ) {
    if ( typeof value.x === "number" && typeof value.y === "number" ) {
      return `${ displayText( value.x ) }, ${ displayText( value.y ) }`;
    }

    return Object.values( value )
      .map( displayText )
      .join( ", " );
  }

  return String( value );
}

/**
 * Readout widget: a label and a live **text** value — the sketch's current
 * font, a preset name, a mode, a boolean switch. The numeric family (counter /
 * gauge / sparkline) formats a number; this one prints whatever the source
 * carries, which is what makes a non-numeric parameter observable on canvas.
 *
 * `layout` picks between the counter's stacked pair (small caption over the
 * value) and one "LABEL value" line.
 */
export default function readout(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const raw = displayText( resolveValue( cfg.source ) );
    const value = cfg.uppercase ? raw.toUpperCase() : raw;

    const {
      x,
      y,
      align
    } = resolveAnchor(
      p,
      cfg.anchor ?? "top-left",
      cfg.offset
    );

    const s = cfg.size ?? 20;
    const inline = cfg.layout === "inline";
    const labelSize = inline ? s * 0.6 : s * 0.42;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const labelFill = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      170
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

    p.push();
    p.textFont( font );
    p.textSize( labelSize );
    const labelWidth = label ? p.textWidth( label ) : 0;

    p.textSize( s );
    const valueWidth = p.textWidth( value );

    p.pop();

    const gap = s * 0.45;
    const blockWidth = inline
      ? valueWidth + ( label ? labelWidth + gap : 0 )
      : Math.max(
        labelWidth,
        valueWidth
      );
    const blockHeight = inline || !label ? s : s * 1.5;

    const rect = anchoredRect(
      p,
      x,
      y,
      align,
      blockWidth,
      blockHeight
    );

    reportWidgetBounds(
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );

    paintWidgetBackground(
      style,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      s
    );

    const write = (
      text, textX, textY, size, textFill, textAlign
    ) =>
      string.write(
        text,
        textX,
        textY,
        {
          size,
          font,
          fill: textFill,
          stroke: false,
          strokeWeight: 0,
          blendMode: blend,
          textWidth: -1,
          textAlign
        }
      );

    if ( inline ) {
      // Laid out left to right inside the reported rectangle, so the pair stays
      // one line whatever corner it is anchored to.
      if ( label ) {
        write(
          label,
          rect.x,
          // Sits on the value's own baseline rather than the block's top.
          rect.y + ( s - labelSize ) * 0.55,
          labelSize,
          labelFill,
          [
            p.LEFT,
            p.TOP
          ]
        );
      }

      write(
        value,
        rect.x + ( label ? labelWidth + gap : 0 ),
        rect.y,
        s,
        fill,
        [
          p.LEFT,
          p.TOP
        ]
      );

      return;
    }

    // Stacked: the counter's own geometry — caption at the anchor, value half a
    // line below it, both aligned to the anchored corner.
    if ( label ) {
      write(
        label,
        x,
        y,
        labelSize,
        labelFill,
        align
      );
    }

    write(
      value,
      x,
      label ? y + s * 0.5 : y,
      s,
      fill,
      label
        ? [
          align[ 0 ],
          p.TOP
        ]
        : align
    );
  } );
}
