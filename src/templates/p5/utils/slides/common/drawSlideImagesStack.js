import imageUtils from "../../imageUtils.js";
import animation from "../../animation.js";
import easing from "../../easing.js";
import * as common from "../../common.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";
import {
  getP5
} from "../../sketch.js";

export default function drawSlideImagesStack(
  imagesStackOption, slideOptions
) {
  const p = getP5();
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

  const imageIndexDisplay = p.map(
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
    const availableW = p.width * stackScale - 2 * stackMargin;
    const availableH = p.height * stackScale - 2 * stackMargin;
    const img0 = images[ 0 ].img;

    if ( img0?.width && availableW > 0 && availableH > 0 ) {
      const fit = Math.min(
        availableW / img0.width,
        availableH / img0.height
      );
      const w = img0.width * fit * stackScale;
      const h = img0.height * fit * stackScale;

      reportItemBounds(
        position.x * p.width - w / 2,
        position.y * p.height - h / 2,
        w,
        h
      );
    }
  }

  p.push();

  p.translate(
    position.x * p.width,
    position.y * p.height
  );
  p.rotate( rotationValue );

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      continue;
    }

    if ( progressiveRotation !== 0 ) {
      p.rotate( p.map(
        i,
        0,
        images.length - 1,
        -progressiveRotation,
        progressiveRotation
      ) );
    }

    const imagePosition = p.createVector();

    if ( imagesStackOption.animation ) {
      if ( imagesStackOption.animation.name === "random" ) {
        const randomShiftMargin = imagesStackOption.animation.shift || 80;

        imagePosition.add(
          p.map(
            p.noise( i ),
            0,
            1,
            -randomShiftMargin,
            randomShiftMargin
          ),
          p.map(
            p.noise( i ),
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

  p.pop();
}
