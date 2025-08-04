import {
  string
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideText( textOption ) {
  const horizontalMargin = textOption.horizontalMargin ?? .015;
  const verticalMargin = textOption.verticalMargin ?? .015;

  string.write(
    textOption.content,
    ( width * horizontalMargin ) + width * textOption.position.x,
    ( height * verticalMargin ) + height * textOption.position.y,
    {
      size: Number( textOption.size ),
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: textOption.align,
      blendMode: textOption.blend,
      fill: color( ...textOption.fill ),
      stroke: color( ...textOption.stroke ),
      textWidth: width - ( 2 * ( width * horizontalMargin ) ),
      textHeight: height - ( 2 * ( height * verticalMargin ) )
    }
  );
}