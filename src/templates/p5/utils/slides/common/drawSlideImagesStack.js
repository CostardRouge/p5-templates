import imageUtils from "../../imageUtils.js";
import animation from "../../animation.js";
import easing from "../../easing.js";
import * as common from "../../common.js";

export default function drawSlideImagesStack(
  imagesStackOption, slideOptions
) {
  const {
    sources,
    position,
    scale: scaleValue,
    rotation: rotationValue,
    progressiveRotation,
  } = imagesStackOption;

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

  push();

  translate(
    position.x * width,
    position.y * height
  );
  rotate( rotationValue );

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      continue;
    }

    if ( progressiveRotation !== 0 ) {
      rotate( map(
        i,
        0,
        images.length - 1,
        -progressiveRotation,
        progressiveRotation
      ) );
    }

    const imagePosition = createVector();

    if ( imagesStackOption.animation ) {
      if ( imagesStackOption.animation.name === "random" ) {
        const randomShiftMargin = imagesStackOption.animation.shift || 80;

        imagePosition.add(
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
          )
        );
      }
    }

    imageUtils.marginImage( {
      center: imagesStackOption.center ?? true,
      margin: imagesStackOption.margin ?? 80,
      position: imagePosition,
      scale: scaleValue,
      img: images[ i ].img,
    } );
  }

  pop();
}
