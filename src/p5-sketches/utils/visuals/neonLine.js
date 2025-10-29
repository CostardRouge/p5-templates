import easing from "../../utils/easing.js";
import colors from "../../utils/colors.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import iterators from "../../utils/iterators.js";

export default function neonLine( {
  innerCircleSize = 10,
  shadowsCount = 3,
  graphics = window,
  vectorsStep = 0.05,
  vectors,
  index
} = {
} ) {
  graphics.noStroke();

  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    iterators.vectors(
      vectors,
      (
        position, _to, innerProgression, totalStep
      ) => {
        const totalProgression = totalStep / vectors.length;

        const circleSize = mappers.fn(
          shadowIndex,
          0,
          shadowsCount,
          innerCircleSize * shadowsCount,
          innerCircleSize,
          easing.easeOutSine
        );

        graphics.fill( colors.rainbow( {
          opacityFactor: map(
            shadowIndex,
            0,
            shadowsCount,
            1,
            3
          ),
          hueOffset: easing.easeOutSine( shadowProgression * shadowIndex ),
          hueIndex: map(
            Math.sin( animation.angle
              + shadowProgression
              + totalProgression ),
            -1,
            1,
            -PI,
            PI
          ) * 4,
        } ) );

        graphics.circle(
          position.x,
          position.y,
          circleSize
        );
      },
      vectorsStep
    );
  }
}