import easing from "@/p5/utils/easing.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import converters from "@/p5/utils/converters.js";

export default function neonGraffiti( {
  amplitude = 200,
  shadowsCount = 3,
  stepsCount = 500,
  innerCircleSize = 40,
  stepAngleAmplitude = 1,
  sinAmplitudeMultiplier = 2,
  cosAmplitudeMultiplier = 1,
  sinAngleMultiplier = 2,
  cosAngleMultiplier = 2,
  hueIndexMultiplier = 1.5,
  hueAmplitude = PI,
  circleSizeEasing = "easeOutSine",
  positionSinEasing = "easeInOutQuad",
  positionCosEasing = "easeInOutSine",
  positionCosMultiplier = 8,
  hueEasing = "easeInOutSine",
  hueStepDivider = 10,
  opacityStart = 1,
  opacityEnd = 2.25,
  start = createVector(
    0,
    height / 2
  ),
  end = createVector(
    width,
    height / 2
  )
} = {
} ) {
  noStroke();

  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    const circleSizeEasingFn = easing?.[circleSizeEasing] ?? easing.easeOutSine;
    const circleSize = mappers.fn(
      shadowIndex,
      0,
      shadowsCount,
      innerCircleSize * shadowsCount,
      innerCircleSize,
      circleSizeEasingFn
    );

    for ( let step = 0; step < stepsCount; step++ ) {
      const stepProgression = step / stepsCount;
      const stepAngle = map(
        stepProgression,
        0,
        1,
        -stepAngleAmplitude,
        stepAngleAmplitude
      );
      const position = p5.Vector.lerp(
        start,
        end,
        step / stepsCount,
      );

      position.add(
        converters.polar.get(
          Math.sin,
          amplitude * sinAmplitudeMultiplier,
          map(
            Math.sin( animation.angle + stepAngle + slides.index ),
            // Math.cos( animation.angle + stepAngle + easing.easeInOutSine( stepProgression ) ),
            -1,
            1,
            -TAU,
            TAU
          ),
        ),
        converters.polar.get(
          Math.sin,
          amplitude * cosAmplitudeMultiplier,
          map(
            // Math.cos( animation.angle + stepAngle * 2 + easing.easeInOutSine( shadowProgression ) ),
            Math.cos( animation.angle + stepAngle + slides.index ),
            -1,
            1,
            -PI,
            PI
          )
        )
      );

      const positionSinEasingFn = easing?.[positionSinEasing] ?? easing.easeInOutQuad;
      const positionCosEasingFn = easing?.[positionCosEasing] ?? easing.easeInOutSine;

      position.add(
        map(
          Math.sin( +animation.angle * sinAngleMultiplier
            + positionSinEasingFn( stepProgression ) ),
          -1,
          1,
          -amplitude,
          amplitude
        ),
        map(
          Math.cos( +animation.angle * cosAngleMultiplier
            + positionCosEasingFn( stepProgression ) * positionCosMultiplier ),
          -1,
          1,
          -amplitude,
          amplitude
        )
      );

      const hueEasingFn = easing?.[hueEasing] ?? easing.easeInOutSine;

      fill( colors.rainbow( {
        opacityFactor: map(
          shadowIndex,
          0,
          shadowsCount,
          opacityStart,
          opacityEnd,
        ),
        hueOffset: hueEasingFn( shadowProgression + stepProgression / hueStepDivider ),
        // hueOffset: easing.easeOutSine( shadowProgression + shadowIndex / 2 ),
        hueIndex: map(
          Math.sin( animation.angle
            + easing.easeOutSine( stepAngle ) * -3 ),
          -1,
          1,
          -hueAmplitude,
          hueAmplitude
        ) * hueIndexMultiplier,
      } ) );

      circle(
        position.x,
        position.y,
        circleSize
      );
    }
  }
}