import string from "../../string.js";

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
  const horizontalMargin = parseFloatDefault( textOption.margin.horizontal );
  const verticalMargin = parseFloatDefault( textOption.margin.vertical );

  string.write(
    textOption.content,
    width * horizontalMargin + width * textOption.position.x,
    height * verticalMargin + height * textOption.position.y,
    {
      size: Number( textOption.size ),
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: [
        textOption.alignment?.horizontal ?? "center",
        textOption.alignment?.vertical ?? "baseline",
      ],
      blendMode: textOption.blend,
      fill: color( ...textOption.fill ),
      stroke: color( ...textOption.stroke ),
      textWidth: width - 2 * ( width * horizontalMargin ),
      textHeight: height - 2 * ( height * verticalMargin ),
    }
  );
}
