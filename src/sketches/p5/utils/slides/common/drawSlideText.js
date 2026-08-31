import string from "../../string.js";
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

export default function drawSlideText( textOption ) {
  const p = getP5();
  const horizontalMargin = parseFloatDefault( textOption.margin.horizontal );
  const verticalMargin = parseFloatDefault( textOption.margin.vertical );

  const x = p.width * horizontalMargin + p.width * textOption.position.x;
  const y = p.height * verticalMargin + p.height * textOption.position.y;
  const textWidth = p.width - 2 * ( p.width * horizontalMargin );
  const textHeight = p.height - 2 * ( p.height * verticalMargin );
  const size = Number( textOption.size );
  const horizontalAlign = textOption.alignment?.horizontal ?? "center";
  const verticalAlign = textOption.alignment?.vertical ?? "baseline";

  const box = string.write(
    textOption.content,
    x,
    y,
    {
      size,
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: [
        horizontalAlign,
        verticalAlign
      ],
      blendMode: textOption.blend,
      fill: p.color( ...textOption.fill ),
      stroke: p.color( ...textOption.stroke ),
      textWidth,
      textHeight
    }
  );

  // Report the visible glyph rectangle so the item can be grabbed by what the
  // user sees rather than by its (often off-glyph) layout anchor.
  reportTextItemBounds( {
    text: textOption.content,
    box,
    x,
    y,
    layoutWidth: textWidth,
    layoutHeight: textHeight,
    size,
    horizontalAlign,
    verticalAlign
  } );
}
