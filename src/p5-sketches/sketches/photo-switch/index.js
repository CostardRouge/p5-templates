import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
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

  const margin = 80;
  const imageIndexDisplay = ~~( animation.progression * images.length ) % images.length;

  const {
    img
  } = images[ imageIndexDisplay ];

  imageUtils.marginImage( {
    position: createVector(
      width / 2,
      height / 2
    ),
    center: true,
    margin,
    img
  } );
} );
