import string from "../../string.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  getFont,
  toColor,
  withHudTransform
} from "./common.js";

/**
 * Resolve the box rect in pixels. A probe bound via `source` that pushed an
 * { x, y, w, h } object takes precedence; otherwise the fractional `region`.
 */
function resolveRegion(
  p, cfg
) {
  if ( cfg.source ) {
    const value = resolveValue( cfg.source );

    if (
      value &&
      typeof value.w === "number" &&
      typeof value.h === "number"
    ) {
      return {
        x: value.x ?? 0,
        y: value.y ?? 0,
        w: value.w,
        h: value.h
      };
    }
  }

  const region = cfg.region ?? {
    x: 0.2,
    y: 0.2,
    w: 0.6,
    h: 0.6
  };

  return {
    x: ( region.x ?? 0 ) * p.width,
    y: ( region.y ?? 0 ) * p.height,
    w: ( region.w ?? 0 ) * p.width,
    h: ( region.h ?? 0 ) * p.height
  };
}

/**
 * Bounding-box widget: a region rect with corner ticks plus a label + WxH dims.
 */
export default function boundingBox(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const box = resolveRegion(
      p,
      cfg
    );
    const s = cfg.size ?? 14;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const font = getFont( cfg.font ?? style.font );
    const blend = cfg.blend ?? style.blend;
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || "ROI" ).toUpperCase();

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    p.noFill();
    p.stroke( fill );
    p.strokeWeight( Math.max(
      1,
      s * 0.08
    ) );
    p.rect(
      box.x,
      box.y,
      box.w,
      box.h
    );

    const tick = s * 0.8;

    p.strokeWeight( Math.max(
      1,
      s * 0.14
    ) );

    const corners = [
      [
        box.x,
        box.y,
        1,
        1
      ],
      [
        box.x + box.w,
        box.y,
        -1,
        1
      ],
      [
        box.x,
        box.y + box.h,
        1,
        -1
      ],
      [
        box.x + box.w,
        box.y + box.h,
        -1,
        -1
      ]
    ];

    for ( const [
      cx,
      cy,
      sx,
      sy
    ] of corners ) {
      p.line(
        cx,
        cy,
        cx + sx * tick,
        cy
      );
      p.line(
        cx,
        cy,
        cx,
        cy + sy * tick
      );
    }

    p.pop();

    string.write(
      `${ label } ${ Math.round( box.w ) }×${ Math.round( box.h ) }`,
      box.x,
      box.y - s * 0.3,
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
