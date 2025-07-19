import {
  colors,
  easing,
  mappers,
  animation,
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawCircleEchoes( {
  position,
  echoColor = color(
    128,
    128,
    255
  ),
  count,
  size
} ) {
  noFill();

  for ( let circleEchoIndex = 0; circleEchoIndex < count; circleEchoIndex++ ) {
    const circleEchoProgression = easing.easeInExpo( circleEchoIndex / count );

    strokeWeight( 1 );
    stroke( echoColor );

    circle(
      position.x,
      position.y,
      size * circleEchoProgression
    );
  }
}