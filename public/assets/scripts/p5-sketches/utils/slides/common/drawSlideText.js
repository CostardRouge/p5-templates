import {
  string
} from "/assets/scripts/p5-sketches/utils/index.js";

const parseFloatDefault = (
  value, _default = .015
) => {
  const float = Number.parseFloat( value );

  if ( Number.isFinite( float ) ) {
    return float;
  }

  return _default;
};

export default function drawSlideText( textOption ) {
  const horizontalMargin = parseFloatDefault( textOption.horizontalMargin );
  const verticalMargin = parseFloatDefault( textOption.verticalMargin );

  string.write(
    textOption.content,
    ( width * horizontalMargin ) + width * textOption.position.x,
    ( height * verticalMargin ) + height * textOption.position.y,
    {
      size: Number( textOption.size ),
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: [
        textOption?.align?.[ 0 ] ?? "center",
        textOption?.align?.[ 1 ] ?? "baseline",
      ],
      blendMode: textOption.blend,
      fill: color( ...textOption.fill ),
      stroke: color( ...textOption.stroke ),
      textWidth: width - ( 2 * ( width * horizontalMargin ) ),
      textHeight: height - ( 2 * ( height * verticalMargin ) )
    }
  );
}