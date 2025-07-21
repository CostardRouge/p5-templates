import {
  colors,
  mappers,
  animation,
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawNeonDot( {
  sizeRange = [
    300,
    75
  ],
  shadowsCount = 3,
  graphics = window,
  position,
  index
} = {
} ) {
  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    const circleSize = mappers.fn(
      shadowIndex,
      0,
      shadowsCount,
      sizeRange[ 0 ],
      sizeRange[ 1 ],
    );

    graphics.stroke( colors.rainbow( {
      opacityFactor: map(
        shadowIndex,
        0,
        shadowsCount,
        2,
        0.75
      ),
      hueOffset: ( animation.circularProgression + shadowProgression ),
      hueIndex: map(
        index,
        0,
        1,
        -PI,
        PI
      ),
    } ) );

    graphics.strokeWeight( circleSize );

    graphics.point(
      position.x,
      position.y
    );
  }
}