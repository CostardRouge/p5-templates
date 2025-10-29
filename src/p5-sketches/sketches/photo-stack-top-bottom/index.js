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
  // options.colors.text = [252, 209, 83]
  // blendMode(HARD_LIGHT);

  const images = cache.get( "images" );

  background( ...options.colors.background );

  const margin = 80;
  const imageIndexDisplay = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutExpo_
  );

  // Calculate step size for vertical positioning
  const availableVerticalSpace = height - 2 * margin;
  const step = availableVerticalSpace / ( images.length - 1 || 1 );

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const {
      img
    } = images[ i ];
    const y = margin + i * step;

    imageUtils.marginImage( {
      position: createVector(
        width / 2,
        y
      ),
      center: true,
      scale: .8,
      margin,
      img
    } );
  }
} );
