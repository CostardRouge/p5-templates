import string from "../../string.js";
import {
  getP5
} from "../../sketch";

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

  string.write(
    textOption.content,
    p.width * horizontalMargin + p.width * textOption.position.x,
    p.height * verticalMargin + p.height * textOption.position.y,
    {
      size: Number( textOption.size ),
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: [
        textOption.alignment?.horizontal ?? "center",
        textOption.alignment?.vertical ?? "baseline"
      ],
      blendMode: textOption.blend,
      fill: p.color( ...textOption.fill ),
      stroke: p.color( ...textOption.stroke ),
      textWidth: p.width - 2 * ( p.width * horizontalMargin ),
      textHeight: p.height - 2 * ( p.height * verticalMargin )
    }
  );
}
