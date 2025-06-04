import {
  sketch, easing, string, mappers, animation, events, shapes, cache, captureOptions as options, imageUtils
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
    },
  }
);

sketch.draw( (
  _time, center, favoriteColor
) => {
  const images = cache.get( "images" );

  background( ...options.colors.background );

  if ( options.lines || false ) {
    stroke( options.colors.accent );
    stroke( 0 );

    shapes.hl( 0 );
    shapes.hl( height );

    shapes.vl( 0 );
    shapes.vl( width );
  }

  if ( options.durationBar || true ) {
    shapes.sketchDurationBar( color( ...options.colors.accent ) );
  }

  const count = options.count || 20;
  const imageIndexes = images.map( (
    _, index
  ) => index );

  const imageIndex = mappers.circularIndex(
    animation.linearProgression() * images.length,
    imageIndexes
  );

  const {
    img, filename
  } = images[ imageIndex ];

  const imageStepAnimationProgression = options.animationProgression || "triangleProgression";
  // const imageStepAnimationProgression = options.animationProgression || "linearProgression";
  const imageStepAnimationProgressionComponent = animation?.[ imageStepAnimationProgression ];
  const isImageStepAnimationProgressionComponentFunction = typeof imageStepAnimationProgressionComponent === "function";

  const imageStepIndexMapValue = isImageStepAnimationProgressionComponentFunction ? imageStepAnimationProgressionComponent( images.length ) : imageStepAnimationProgressionComponent;
  const imageStepMin = options.zoom ? 1 : 0;
  const imageStepMax = options.zoom ? 0 : 1;
  const imageStepIndex = map(
    imageStepIndexMapValue,
    imageStepMin,
    imageStepMax,
    0,
    count
  );

  for ( let i = 0; i < count; i++ ) {
    if ( imageStepIndex < i ) {
      break;
    }

    const t = i / count;
    const scaleEasingFunction = options?.scaleEasingFunctionName || "easeOutQuad";
    // const scaleEasingFunction = options?.scaleEasingFunctionName || "easeOutBounce";

    push();
    translate(
      width / 2,
      height / 2
    );

    if ( options.rotate || false ) {
      rotate( map(
        i,
        0,
        count,
        0,
        PI / 2
      ) );
    }

    imageUtils.marginImage( {
      img,
      position: createVector(
        0,
        0
      ),
      center: true,
      fill: true,
      scale: mappers.fn(
        t,
        1,
        Number( options.scaleStart ) || 0,
        Number( options.scaleEnd ) || 0,
        1,
        easing?.[ scaleEasingFunction ]
      )
    } );

    pop();
  }

  if ( animation.progression < 0.1 ) {
    string.write(
      options.name.replaceAll(
        "-",
        "\n"
      ),
      0,
      height / 2,
      {
        size: 172,
        stroke: color( ...options.colors.text ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }
} );
