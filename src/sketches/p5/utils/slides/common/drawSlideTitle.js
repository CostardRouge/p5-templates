import string from "../../string.js";
import animation from "../../animation.js";
import options from "../../options.js";
import {
  getP5
} from "../../sketch";
import reportTextItemBounds from "./textItemBounds.js";

const parseFloatDefault = (
  value, _default = 0.015
) => {
  const float = Number.parseFloat( value );

  if ( Number.isFinite( float ) ) {
    return float;
  }

  return _default;
};

const getFont = ( fontKey ) =>
  ( string.fonts && string.fonts[ fontKey ] ) || string.fonts.martian;

// Content-item counterpart of the former per-sketch renderTitle. Keeps the
// title's distinctive behaviour: an optional display window
// (displayFrom..displayTo, a fraction of the animation loop) and a fallback to
// the (uppercased, hyphen-broken) sketch name when `content` is left empty.
export default function drawSlideTitle( titleOption ) {
  // Only render inside the display window.
  const displayFrom = titleOption.displayFrom ?? 0.0;
  const displayTo = titleOption.displayTo ?? 0.2;
  const withinWindow =
    animation.progression >= displayFrom && animation.progression <= displayTo;

  if ( !withinWindow ) {
    return;
  }

  // Empty content falls back to the uppercased, hyphen-broken sketch name.
  const customText = titleOption.content?.trim?.() || "";
  const defaultText = ( options.name || "" ).toUpperCase().replaceAll(
    "-",
    "\n"
  );
  const text = customText !== "" ? customText : defaultText;

  if ( !text ) {
    return;
  }

  const p = getP5();
  const font = getFont( titleOption.font );
  const horizontalMargin = parseFloatDefault( titleOption.margin?.horizontal );
  const verticalMargin = parseFloatDefault( titleOption.margin?.vertical );

  const x = p.width * horizontalMargin + p.width * titleOption.position.x;
  const y = p.height * verticalMargin + p.height * titleOption.position.y;
  const textWidth = p.width - 2 * ( p.width * horizontalMargin );
  const textHeight = p.height - 2 * ( p.height * verticalMargin );
  const size = Number( titleOption.size ?? 128 );
  const horizontalAlign = titleOption.alignment?.horizontal ?? "center";
  const verticalAlign = titleOption.alignment?.vertical ?? "center";

  const box = string.write(
    text,
    x,
    y,
    {
      size,
      font,
      textAlign: [
        horizontalAlign,
        verticalAlign
      ],
      blendMode: titleOption.blend || "source-over",
      fill: p.color( ...titleOption.fill ),
      stroke: p.color( ...titleOption.stroke ),
      strokeWeight: titleOption.strokeWeight ?? 0,
      textWidth,
      textHeight,
      popPush: true
    }
  );

  // Report the visible glyph rectangle so the title can be grabbed on canvas by
  // its letters. The default title is the sketch name broken on hyphens, so it
  // is routinely multi-line — hand the helper a per-line measure rather than let
  // it read a single-run measurement of the whole block.
  reportTextItemBounds( {
    text,
    box,
    x,
    y,
    layoutWidth: textWidth,
    layoutHeight: textHeight,
    size,
    horizontalAlign,
    verticalAlign,
    measureLine: ( line ) => {
      p.push();
      p.textFont( font );
      p.textSize( size );

      const width = p.textWidth( line );

      p.pop();

      return width;
    }
  } );
}
