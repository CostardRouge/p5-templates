import string from "../../string.js";
import animation from "../../animation.js";
import {
  resolveValue
} from "../sources.js";
import {
  getFont,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Coerce a probe/built-in value into a 2D point. Accepts { x, y }, p5.Vector,
 * or an [x, y] array.
 */
function toPoint( value ) {
  if ( !value ) {
    return null;
  }

  if ( typeof value.x === "number" && typeof value.y === "number" ) {
    return {
      x: value.x,
      y: value.y
    };
  }

  if ( Array.isArray( value ) && value.length >= 2 ) {
    return {
      x: value[ 0 ],
      y: value[ 1 ]
    };
  }

  return null;
}

/**
 * Crosshairs widget: full-canvas guide lines through a tracked point, a rotating
 * reticle, and an (x, y) readout. Bind `source` to a probe pushed as a point.
 */
export default function crosshairs(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const point = toPoint( resolveValue( cfg.source ) );

    if ( !point ) {
      return;
    }

    const s = cfg.size ?? 16;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const guide = toColor(
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

    p.stroke( guide );
    p.strokeWeight( 1 );
    p.line(
      0,
      point.y,
      p.width,
      point.y
    );
    p.line(
      point.x,
      0,
      point.x,
      p.height
    );

    p.noFill();
    p.stroke( fill );
    p.strokeWeight( Math.max(
      1,
      s * 0.1
    ) );
    p.push();
    p.translate(
      point.x,
      point.y
    );
    p.rotate( animation.angle );
    p.rectMode( p.CENTER );
    p.rect(
      0,
      0,
      s * 1.8,
      s * 1.8
    );
    p.pop();
    p.pop();

    string.write(
      `${ Math.round( point.x ) }, ${ Math.round( point.y ) }`,
      point.x + s,
      point.y - s * 0.5,
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
          p.BOTTOM
        ]
      }
    );
  } );
}
