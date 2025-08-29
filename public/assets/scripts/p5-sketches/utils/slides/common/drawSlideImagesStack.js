import {
  common, imageUtils, animation, easing
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideImagesStack(
  imagesStackOption, slideOptions
) {
  const sources = imagesStackOption?.sources;

  if ( !sources ) {
    return;
  }

  const images = common.getAssets(
    slideOptions,
    "images",
    sources
  );

  if ( !images || !images.length ) {
    return;
  }

  const imageIndexDisplay = map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length,
    easing.easeInOutBack
  );

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = createVector(
      width * imagesStackOption.position.x,
      height * imagesStackOption.position.y
    );

    if ( imagesStackOption.animation ) {
      if ( imagesStackOption.animation.name === "random" ) {
        const randomShiftMargin = imagesStackOption.animation.shift || 80;

        imagePosition
          .add(
            map(
              noise( i ),
              0,
              1,
              -randomShiftMargin,
              randomShiftMargin
            ),
            map(
              noise( i ),
              0,
              1,
              -randomShiftMargin,
              randomShiftMargin
            ),
          );
      }
    }

    imageUtils.marginImage( {
      center: imagesStackOption.center ?? true,
      margin: imagesStackOption.margin ?? 80,
      position: imagePosition,
      img: images[ i ].img,
    } );
  }
}