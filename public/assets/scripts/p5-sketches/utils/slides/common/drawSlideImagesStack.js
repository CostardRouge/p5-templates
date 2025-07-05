import {
  common, imageUtils, animation, easing
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideImagesStack(
  imagesStackOption, slideOptions
) {
  const images = common.getAssets( slideOptions );

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

  const shiftMargin = imagesStackOption.shift || 80;

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const imagePosition = createVector(
      width * imagesStackOption.position.x,
      height * imagesStackOption.position.y
    );

    if ( imagesStackOption.animation === "random" ) {
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
      center: imagesStackOption.center ?? true,
      margin: imagesStackOption.margin ?? 80,
      position: imagePosition,
      img: images[ i ].img,
    } );
  }
}