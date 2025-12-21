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
      scale: 0.8,
      margin,
      img,
    } );
  }
} );
