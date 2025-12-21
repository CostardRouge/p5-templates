import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

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

  background( ...options.sketch.colors.background );

  const imageIndexDisplay = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutBack
  );

  const shiftMargin = options.sketch.shiftMargin;

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = createVector(
      width / 2,
      height / 2
    );

    if ( options.sketch.randomPosition ) {
      imagePosition.add(
        map(
          noise( i ),
          0,
          1,
          -shiftMargin,
          shiftMargin
        ),
        map(
          noise( i ),
          0,
          1,
          -shiftMargin,
          shiftMargin
        )
      );
    }

    imageUtils.marginImage( {
      position: imagePosition,
      img: images[ i ].img,
      center: true,
      margin: options.sketch.imageMargin,
    } );
  }
} );
