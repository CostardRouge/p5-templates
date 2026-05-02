import options from "@/p5/utils/options.js";

import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  _time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const imageIndexDisplay = mappers.fn(
    animation.triangleProgression( options.sketch.animationCount ?? 3 ),
    0,
    1,
    0,
    images.length,
    easing?.[ options.sketch.displayEasing ] ?? easing.linear
  );

  for ( let i = 0; i < images.length; i++ ) {
    const imageProgression = i / ( images.length - 1 );

    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = p.createVector(
      p.width / 2,
      p.height / 2
    );

    if ( options.sketch.randomPosition.x > 0 ) {
      const xMargin = ( options.sketch.randomPosition.x ?? 0.3 ) * p.width;

      imagePosition.add( p.map(
        p.noise(
          i,
          imageProgression,
          xMargin
        ),
        0,
        1,
        -xMargin,
        xMargin
      ) );
    }

    if ( options.sketch.randomPosition.y > 0 ) {
      const yMargin = ( options.sketch.randomPosition.y ?? 0.5 ) * p.height;

      imagePosition.add(
        0,
        p.map(
          p.noise(
            i,
            imageProgression,
            yMargin
          ),
          0,
          1,
          -yMargin,
          yMargin
        )
      );
    }

    const randomAngle = p.noise(
      i,
      imageProgression,
    ) * p.radians( options.sketch.randomAngle ?? 15 ) * ( i % 2 === 0 ? -1 : 1 );

    imageUtils.marginImage( {
      img: images[ i ].img,
      angle: randomAngle,
      position: imagePosition,
      margin: p.width * options.sketch.imageStyle?.margin,
      scale: options.sketch.imageStyle?.scale ?? 1,
      center: options.sketch.imageStyle?.center ?? true,
      clip: options.sketch.imageStyle?.clip ?? false,
      fill: options.sketch.imageStyle?.fill ?? true,
    } );
  }
} );
