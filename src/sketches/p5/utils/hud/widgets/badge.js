import string from "../../string.js";
import {
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

// Separator drawn between each printed segment (the "little vertical dot").
const SEPARATOR = "  ·  ";

/**
 * Resolve one badge segment token to its display text. `resolution-fps` is a
 * convenience combining both readouts; the rest map to a single live source.
 * During recording the fps is the target framerate (deterministic).
 */
function segmentText( token ) {
  switch ( token ) {
    case "resolution":
      return String( resolveValue( "resolution" ) ?? "" );
    case "fps":
      return `${ resolveValue( "fps" ) } FPS`;
    case "resolution-fps":
      return `${ resolveValue( "resolution" ) }${ SEPARATOR }${ resolveValue( "fps" ) } FPS`;
    case "engine":
      return String( resolveValue( "engine" ) ?? "" );
    case "category":
      return String( resolveValue( "category" ) ?? "" );
    case "name":
      return String( resolveValue( "name" ) ?? "" );
    default:
      return "";
  }
}

/**
 * Badge widget: a compact, composable readout. `segments` is an ordered list of
 * value tokens (resolution / fps / engine / category / name …) printed with a
 * "·" separator; `override` replaces the whole text when set.
 */
export default function badge(
  cfg, style, part
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

    const override = String( cfg.override ?? "" ).trim();
    const segments = Array.isArray( cfg.segments ) ? cfg.segments : [];

    const text = override
      ? override
      : segments
        .map( segmentText )
        .map( ( part ) => part.trim() )
        .filter( Boolean )
        .join( SEPARATOR );

    // Nothing to print (no segments / all empty and no override) — draw nothing.
    if ( !text ) {
      return;
    }

    const size = cfg.size ?? 20;
    const fill = toColor(
      p,
      cfg.fill ?? style.fill
    );
    const font = getFont( cfg.font ?? style.font );

    p.push();
    p.textFont( font );
    p.textSize( size );
    const width = p.textWidth( text );

    p.pop();

    // Report the visible rectangle so the on-canvas drag can grab this badge.
    const rect = anchoredRect(
      p,
      x,
      y,
      align,
      width,
      size
    );

    reportWidgetBounds(
      part,
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
      size
    );

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
