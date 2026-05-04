import easing from "@/p5/utils/easing.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import iterators from "@/p5/utils/iterators.js";

export default function drawNeonLine( {
  innerCircleSize = 10,
  shadowsCount = 3,
  graphics = getP5(),
  vectorsStep = 0.05,
  vectors,
  index
} = {} ) {
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
          hueIndex:
              map(
                Math.sin( animation.angle + shadowProgression + totalProgression ),
                -1,
                1,
                -PI,
                PI
              ) * 4
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
