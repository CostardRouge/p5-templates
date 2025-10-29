import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
import easing from "../../utils/easing.js";
import sketch from "../../utils/sketch.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";

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

  const imageIndexDisplay = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutBack
  );

  const shiftMargin = options.shiftMargin || 80;

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = createVector(
      width / 2,
      height / 2
    );

    if ( options.randomPosition || true ) {
      imagePosition
        .add(
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
          ),
        );
    }

    imageUtils.marginImage( {
      position: imagePosition,
      img: images[ i ].img,
      center: true,
      margin: 80
    } );
  }
} );
