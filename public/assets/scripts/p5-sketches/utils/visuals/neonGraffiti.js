import {
  mappers, easing, converters, animation, colors
} from "/assets/scripts/p5-sketches/utils/index.js";

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

    const circleSize = mappers.fn(
      shadowIndex,
      0,
      shadowsCount,
      innerCircleSize * shadowsCount,
      innerCircleSize,
      easing.easeOutSine
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
            Math.sin( animation.angle + stepAngle ),
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
            Math.cos( animation.angle + stepAngle ),
            -1,
            1,
            -PI,
            PI
          )
        )
      );

      position.add(
        map(
          Math.sin( +animation.angle * sinAngleMultiplier
            + easing.easeInOutQuad( stepProgression ) ),
          -1,
          1,
          -amplitude,
          amplitude
        ),
        map(
          Math.cos( +animation.angle * cosAngleMultiplier
            + easing.easeInOutSine( stepProgression ) * 8 ),
          -1,
          1,
          -amplitude,
          amplitude
        )
      );

      fill( colors.rainbow( {
        opacityFactor: map(
          shadowIndex,
          0,
          shadowsCount,
          1,
          2.25,
        ),
        hueOffset: easing.easeInOutSine( shadowProgression + stepProgression / 10 ),
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