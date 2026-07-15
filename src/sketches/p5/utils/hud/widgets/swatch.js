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
  toHex,
  withHudTransform
} from "./common.js";

/**
 * Coerce a probe/built-in value into an rgb(a) array. Accepts arrays, p5.Color
 * (via .levels), or normalized ._array.
 */
function toRgbArray( value ) {
  if ( Array.isArray( value ) ) {
    return value;
  }

  if ( value && Array.isArray( value.levels ) ) {
    return value.levels;
  }

  if ( value && Array.isArray( value._array ) ) {
    return value._array.map( ( channel ) => Math.round( channel * 255 ) );
  }

  return null;
}

/**
 * Swatch widget: a colour chip with its hex + rgb readout. Bind `source` to a
 * probe pushed with a colour value (e.g. a dominant colour).
 */
export default function swatch(
  cfg, style, part
) {
  withHudTransform( ( p ) => {
    const arr = toRgbArray( resolveValue( cfg.source ) );

    if ( !arr ) {
      return;
    }

    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "COLOR" ).toUpperCase();

    const s = cfg.size ?? 18;
    const chip = s * 1.6;
    const blockW = chip + s * 9;

    const {
      blockX,
      blockY
    } = resolveBlock(
      p,
      cfg.anchor ?? "top-right",
      cfg.offset,
      blockW,
      chip
    );

    // Report the visible rectangle so the on-canvas drag can grab this swatch.
    reportWidgetBounds(
      part,
      blockX,
      blockY,
      blockW,
      chip
    );

    paintWidgetBackground(
      style,
      blockX,
      blockY,
      blockW,
      chip,
      s
    );

    const textFill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const border = toColor(
      p,
      cfg.fill ?? style.fill,
      undefined,
      120
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    p.noStroke();
    p.fill( p.color( ...arr ) );
    p.rect(
      blockX,
      blockY,
      chip,
      chip
    );
    p.noFill();
    p.stroke( border );
    p.strokeWeight( 1 );
    p.rect(
      blockX,
      blockY,
      chip,
      chip
    );
    p.pop();

    const r = Math.round( arr[ 0 ] ?? 0 );
    const g = Math.round( arr[ 1 ] ?? 0 );
    const b = Math.round( arr[ 2 ] ?? 0 );

    string.write(
      `${ label }\n${ toHex( arr ) }  rgb(${ r },${ g },${ b })`,
      blockX + chip + s * 0.5,
      blockY,
      {
        size: s,
        font,
        fill: textFill,
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
