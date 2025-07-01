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
  common,
  cache
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

  shapes.grid( {
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

function drawSlideTexts( options ) {
  if ( !options?.texts || !options?.texts.length ) {
    return;
  }

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
  };

  for ( const textOption of options.texts ) {
    string.write(
      textOption.content,
      ( width * horizontalMargin ) + width * textOption.position.x,
      height * textOption.position.y,
      {
        ...textStyle,
        size: textOption.size,
        textAlign: textOption.align,
      }
    );
  }
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

  drawSlideTexts( options );
  drawSlideMeta( options );
}

export const renderers = {
  intro: drawIntroSlide,

  full: layoutFull,
  split: layoutSplit,
  grid2x2: layoutGrid,
  strip: layoutStrip,
  polaroid: layoutPolaroid
};

// helpers
function getAssets(
  options, type = "images"
) {
  return options.assets?.[ type ]?.map( p =>
    cache.get( `${ type }Map` ).get( p ) ).filter( Boolean ) || [
  ];
}

// layouts
function layoutFull( opts ) {
  const img = getAssets( opts )[ 0 ];

  if ( img ) {
    image(
      img.img,
      0,
      0,
      width,
      height
    );
  }
}

function layoutSplit( opts ) {
  const [
    a,
    b
  ] = getAssets( opts );

  if ( a ) image(
    a.img,
    0,
    0,
    width / 2,
    height
  );
  if ( b ) image(
    b.img,
    width / 2,
    0,
    width / 2,
    height
  );
}

function layoutGrid( opts ) {
  const imgs = getAssets( opts ).slice(
    0,
    4
  );

  imgs.forEach( (
    o, i
  ) => {
    const x = ( i % 2 ) * width / 2;
    const y = Math.floor( i / 2 ) * height / 2;

    image(
      o.img,
      x,
      y,
      width / 2,
      height / 2
    );
  } );
}

function layoutStrip( opts ) {
  const imgs = getAssets( opts );
  const h = height / imgs.length;

  imgs.forEach( (
    o, i
  ) => image(
    o.img,
    0,
    i * h,
    width,
    h
  ) );
}

function layoutPolaroid( opts ) {
  background( 255 );
  const imgs = getAssets( opts );
  const w = width / 2;
  const h = w * 4 / 3;

  imgs.forEach( (
    o, i
  ) => {
    const x = 40 + i * ( w + 40 );
    const y = height / 2 - h / 2;

    push();
    translate(
      x + w / 2,
      y + h / 2
    );
    rotate( radians( -5 + 10 * i ) );
    translate(
      -w / 2,
      -h / 2
    );
    fill( 255 ); noStroke(); rect(
      0,
      0,
      w,
      h + 20,
      10
    );
    image(
      o.img,
      10,
      10,
      w - 20,
      h - 30
    );
    pop();
  } );
}

function autoLayout( images ) {
  const n = images?.length ?? 0;

  if ( n === 1 ) return "full";
  if ( n === 2 ) return "split";
  if ( n <= 4 ) return "grid2x2";

  return "strip";
}

function renderCurrentSlide() {
  const slide = slides.current;

  if ( !slide ) {
    return;
  }

  const {
    layout, ...slideOptions
  } = slide;

  const layoutKey = layout ?? autoLayout( slideOptions?.assets?.images );
  const renderer = renderers[ layoutKey ] ?? renderers.full;

  renderer( slideOptions );
}

sketch.draw( renderCurrentSlide );

