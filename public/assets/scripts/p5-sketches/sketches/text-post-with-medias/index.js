import {
  animation,
  captureOptions as options,
  colors,
  converters,
  easing,
  mappers,
  shapes,
  sketch,
  slides,
  string,
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

sketch.setup(
  () => {
    background( ...options.colors.background );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

function drawGrid( {
  columns,
  rows
} ) {
  for ( let column = 0; column < columns; column++ ) {
    const x = map(
      column,
      0,
      columns,
      0,
      width
    );

    shapes.vl( x );

    for ( let row = 0; row < rows; row++ ) {
      const y = map(
        row,
        0,
        rows,
        0,
        height
      );

      shapes.hl( y );
    }
  }
}

function neonGraffiti( {
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

const horizontalMargin = options.horizontalMargin || .05;
const verticalMargin = options.verticalMargin || .05;

function drawSlideBackground( options ) {
  background( ...options.colors.background );
  stroke( ...options.colors.stroke );
  strokeWeight( options.colors.strokeWeight || 1 );

  const columns = options.columns || 9;
  const rows = columns * height / width;

  drawGrid( {
    columns,
    rows
  } );

  shapes.vl( width );
  shapes.hl( height );
}

function drawSlideMeta( options ) {
  const textStyle = {
    size: 24,
    stroke: color(
      0,
      0,
      0,
      0
    ),
    fill: color( ...options.colors.text, ),
    font: string.fonts.martian,
    textAlign: [
      LEFT,
      LEFT,
    ],
  };

  // top - left;
  string.write(
    options.topLeft,
    width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
    }
  );

  // top-right
  string.write(
    options.topRight,
    -width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
      textAlign: [
        RIGHT,
      ]
    }
  );

  // bottom-left
  string.write(
    options.bottomLeft,
    width * horizontalMargin,
    height * ( 1 - verticalMargin ),
    textStyle
  );

  // bottom-right
  // string.write(
  //   `${ slides.index + 1 } / ${ slides.count }`,
  //   -width * horizontalMargin,
  //   height * ( 1 - verticalMargin ),
  //   {
  //     ...textStyle,
  //     textWidth: width - ( 2 * horizontalMargin ),
  //     textAlign: [
  //       RIGHT,
  //     ]
  //   }
  // );

  const slideProgressionLineStartPosition = createVector(
    width * horizontalMargin,
    height - ( height * horizontalMargin ) + 14
  );

  const slideProgressionLineEndPosition = createVector(
    width - ( width * horizontalMargin ),
    height - ( height * horizontalMargin ) + 14
  );

  const slideProgressionLineCurrentPosition = p5.Vector.lerp(
    slideProgressionLineStartPosition,
    slideProgressionLineEndPosition,
    ( slides.index + 1 ) / slides.count
  );

  stroke( 0 );
  line(
    slideProgressionLineStartPosition.x,
    slideProgressionLineStartPosition.y,
    slideProgressionLineCurrentPosition.x,
    slideProgressionLineCurrentPosition.y
  );
}

function drawIntroSlide( options ) {
  drawSlideBackground( options );
  neonGraffiti( {
    start: createVector(
      0,
      height * options.neonGraffiti.startHeight
    ),
    end: createVector(
      width,
      height * options.neonGraffiti.endHeight
    ),
    amplitude: options.neonGraffiti.amplitude,
    innerCircleSize: options.neonGraffiti.innerCircleSize,
    shadowsCount: options.neonGraffiti.shadowsCount,
    stepAngleAmplitude: options.neonGraffiti.stepAngleAmplitude
  } );

  const textStyle = {
    stroke: color(
      0,
      0,
      0,
      0
    ),
    fill: color( ...options.colors.text, ),
    font: string.fonts.martian,
    textWidth: width - ( 2 * ( width * horizontalMargin ) ),
    textAlign: [
      CENTER,
      CENTER,
    ],
  };

  string.write(
    options.title,
    ( width * horizontalMargin ),
    height / 2 - height / 8,
    {
      size: 196,
      ...textStyle
    }
  );

  string.write(
    options.body,
    ( width * horizontalMargin ),
    height / 2 + height / 5,
    {
      ...textStyle,
      size: 36,
    }
  );

  drawSlideMeta( options );
}

function drawTextSlide( options ) {
  drawSlideBackground( options );
  const {
    startHeight, endHeight, ...neonGraffitiOptions
  } = options.neonGraffiti;

  neonGraffiti( {
    start: createVector(
      0,
      height * startHeight
    ),
    end: createVector(
      width,
      height * endHeight
    ),
    ...neonGraffitiOptions
  } );

  const textStyle = {
    stroke: color(
      0,
      0,
      0,
      0
    ),
    textWidth: width - ( 1 * ( width * horizontalMargin ) ),
    fill: color( ...options.colors.text, ),
    font: string.fonts.martian,
    textAlign: [
      LEFT,
      CENTER,
    ],
  };

  string.write(
    options.title,
    width * horizontalMargin,
    height * 0.2,
    {
      ...textStyle,
      textWidth: width - ( 2 * horizontalMargin ),
      textAlign: [
        LEFT,
      ],
      size: 96
    }
  );

  string.write(
    options.body,
    width * horizontalMargin,
    height * .55,
    {
      ...textStyle,
      size: 36
    }
  );

  drawSlideMeta( options );
}

sketch.draw( (
  time, center, favoriteColor
) => {
  const {
    template, ...slideOptions
  } = slides.current;

  ( {
    intro: drawIntroSlide,
    text: drawTextSlide,
    outro: drawIntroSlide,
  } )?.[ template ]( common.deepMerge(
    slideOptions,
    options
  ) );
} );

