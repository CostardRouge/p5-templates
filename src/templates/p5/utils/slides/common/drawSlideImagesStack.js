import imageUtils from "../../imageUtils.js";
import animation from "../../animation.js";
import easing from "../../easing.js";
import * as common from "../../common.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

export default function drawSlideImagesStack(
  imagesStackOption, slideOptions
) {
  const {
    sources,
    position,
    scale: scaleValue,
    rotation: rotationValue,
    progressiveRotation
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

  // Approximate drawn rectangle for the on-canvas drag's hit-test: the stack
  // is rendered inside translate(position*size) with each image fitted by
  // marginImage into (canvas*scale − 2*margin), centred on the origin —
  // mirror that fit for the first image (rotation ignored on purpose).
  {
    const stackScale = scaleValue ?? 1;
    const stackMargin = imagesStackOption.margin ?? 80;
    const availableW = width * stackScale - 2 * stackMargin;
    const availableH = height * stackScale - 2 * stackMargin;
    const img0 = images[ 0 ].img;

    if ( img0?.width && availableW > 0 && availableH > 0 ) {
      const fit = Math.min(
        availableW / img0.width,
        availableH / img0.height
      );
      const w = img0.width * fit * stackScale;
      const h = img0.height * fit * stackScale;

      reportItemBounds(
        position.x * width - w / 2,
        position.y * height - h / 2,
        w,
        h
      );
    }
  }

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
      img: images[ i ].img
    } );
  }

  pop();
}
