import {
  string
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideText( textOption ) {
  const horizontalMargin = textOption.horizontalMargin ?? .05;
  const verticalMargin = textOption.verticalMargin ?? .05;

  string.write(
    textOption.content,
    ( width * horizontalMargin ) + width * textOption.position.x,
    ( height * verticalMargin ) + height * textOption.position.y,
    {
      size: textOption.size,
      font: string.fonts.martian,
      textAlign: textOption.align,
      fill: color( ...textOption.color ),
      stroke: color( ...textOption.stroke ),
      textWidth: width - ( 2 * ( width * horizontalMargin ) ),
      textHeight: height - ( 2 * ( height * verticalMargin ) )
    }
  );
}