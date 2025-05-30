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
  string
} from "/assets/scripts/p5-sketches/utils/index.js";

let slideSelect = undefined;

const slideSelectOptions = options?.slides?.map( ( {
  template, title
}, index ) => `${ index + 1 } / ${ title ?? template }` );

sketch.setup(
  () => {
    background( ...options.colors.background );

    if ( slideSelectOptions ) {
      slideSelect = createSelect();
      slideSelect.position(
        100,
        options.size.height + 10
      );

      slideSelectOptions.forEach( slideSelectOption => slideSelect.option( slideSelectOption ) );
      slideSelect.selected( slideSelectOptions[ slides.currentIndex ] );
    }
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
  stepAngleAmplitude = PI / 2,
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
          amplitude,
          map(
            // Math.sin( animation.angle + stepAngle ),
            Math.cos( animation.angle + stepAngle * 3 + easing.easeInOutSine( shadowProgression ) ),
            -1,
            1,
            -TAU,
            TAU
          ) / 4,
        ),
        converters.polar.get(
          Math.sin,
          amplitude,
          map(
            // Math.cos( animation.angle + stepAngle * 2 + easing.easeInOutSine( shadowProgression ) ),
            Math.cos( animation.angle + stepAngle ),
            -1,
            1,
            -PI,
            PI
          ) * 2
        )
      );

      fill(
        colors.rainbow( {
          opacityFactor: map(
            shadowIndex,
            0,
            shadowsCount,
            1,
            2.25
          ),
          hueOffset: easing.easeInBack( stepProgression ),
          hueIndex: map(
            Math.sin(
              animation.angle
              + easing.easeInOutBack( stepProgression ) * 2
              + shadowProgression
            ),
            -1,
            1,
            -PI,
            PI
          ),
        } )
      );

      circle(
        position.x,
        position.y,
        circleSize
      );
    }
  }
}

const horizontalMargin = options.colors.horizontalMargin || .05;
const verticalMargin = options.colors.verticalMargin || .05;

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
    size: 192,
    stroke: color(
      0,
      0,
      0,
      0
    ),
    fill: color(
      ...options.colors.text,
    ),
    font: string.fonts.martian,
    textAlign: [
      LEFT,
      LEFT,
    ],
  };

  // top-left
  string.write(
    options.author,
    width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
      size: 24
    }
  );

  // top-right
  string.write(
    "text-post #001",
    -width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
      size: 24,
      textAlign: [
        RIGHT,
      ]
    }
  );

  // bottom-left
  string.write(
    options.date,
    width * horizontalMargin,
    height * ( 1 - verticalMargin ),
    {
      ...textStyle,
      size: 24
    }
  );

  // bottom-right
  string.write(
    `${ slides.currentIndex + 1 } / ${ slides.maxIndex }`,
    -width * horizontalMargin,
    height * ( 1 - verticalMargin ),
    {
      ...textStyle,
      textWidth: width - ( 2 * horizontalMargin ),
      size: 24,
      textAlign: [
        RIGHT,
      ]
    }
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
    fill: color(
      ...options.colors.text,
    ),
    font: string.fonts.martian,
    textAlign: [
      CENTER,
      CENTER,
    ],
  };

  string.write(
    options.body,
    0,
    height / 2 + height / 9,
    {
      ...textStyle,
      size: 36
    }
  );

  string.write(
    options.title,
    0,
    height / 2 - height / 8,
    {
      size: 192,
      ...textStyle,
    }
  );

  drawSlideMeta( options );
}

function drawTextSlide( options ) {
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
    fill: color(
      ...options.colors.text,
    ),
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
      textWidth: width - 2 * ( width * horizontalMargin ),
      size: 36
    }
  );

  drawSlideMeta( options );
}

sketch.draw( ( time, center, favoriteColor ) => {
  const selectedSlideOption = slideSelect.selected();

  slides.currentIndex = slideSelectOptions.indexOf( selectedSlideOption );

  const {
    template, ...slideOptions
  } = slides.current;

  ( {
    intro: drawIntroSlide,
    text: drawTextSlide,
    outro: drawIntroSlide,
  } )?.[ template ](
    deepMerge(
      slideOptions,
      options
    )
  );
} );

function deepMerge( target = {
}, source = {
} ) {
  if ( typeof target !== "object" || target === null ) return target;
  if ( typeof source !== "object" || source === null ) return target;

  for ( const [
    key,
    value
  ] of Object.entries( source ) ) {
    const tVal = target[ key ];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray( value ) &&
      tVal &&
      typeof tVal === "object" &&
      !Array.isArray( tVal )
    ) {
      deepMerge( tVal,
        value ); // recurse on nested plain objects
    } else {
      target[ key ] = Array.isArray( value ) ? [
        ...value
      ] : value; // copy / overwrite
    }
  }

  return target;
}