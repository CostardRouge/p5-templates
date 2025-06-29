import {
  sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

sketch.setup(
  () => {
    background( ...options.colors.background );
    options.noSmooth && noSmooth();
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

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  const images = cache.get( "images" );

  const circlePosition = createVector(
    width / 2,
    height - height / 4
  );

  for ( let imageObjectIndex = 0; imageObjectIndex < images?.length; imageObjectIndex++ ) {
    const imageObjectIndexProgression = imageObjectIndex / ( images.length - 1 );
    // const angle = map(imageObjectIndexProgression, 0, 1, 4*PI/3, 2*PI/3)
    const angle = map(
      imageObjectIndexProgression,
      0,
      1,
      9 * PI / 6,
      PI / 2
    );

    const imageObjectAtIndex = images[ imageObjectIndex ];
    const imageAtIndex = imageObjectAtIndex.img;

    const imagePosition = circlePosition.copy();

    imagePosition.add(
      sin( angle ) * height / 2,
      cos( angle ) * width / 2,
    );

    stroke( "red" );
    strokeWeight( 20 );
    point(
      imagePosition.x,
      imagePosition.y
    );

    imageUtils.marginImage( {
      img: imageAtIndex,
      position: imagePosition,
      scale: 0.5,
      center: true,
    } );
  }

  const defaultTitle = options.name.replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      0,
      height / 2,
      {
        size: 128,
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
