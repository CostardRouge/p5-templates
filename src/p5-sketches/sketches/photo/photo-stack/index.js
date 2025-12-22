import options from "@/p5/utils/options.js";

import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  _time, center, favoriteColor
) => {
  clear();
  background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const imageIndexDisplay = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutBack
  );

  const randomMargin = options.sketch.randomMargin;

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = createVector(
      width / 2,
      height / 2
    );

    if ( options.sketch.randomMargin > 0 ) {
      imagePosition.add(
        map(
          noise( i ),
          0,
          1,
          -randomMargin,
          randomMargin
        ),
        map(
          noise( i ),
          0,
          1,
          -randomMargin,
          randomMargin
        )
      );
    }

    imageUtils.marginImage( {
      img: images[ i ].img,
      position: imagePosition,
      margin: width * options.sketch?.margin,
      scale: options.sketch?.scale ?? 1,
      center: options.sketch?.center ?? true,
      clip: options.sketch?.clip ?? false,
      fill: options.sketch?.fill ?? true,
    } );
  }
} );
