import {
  common, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideImage(
  imageOption, slideOptions
) {
  const images = common.getAssets( slideOptions );

  if ( !images || !images.length ) {
    return;
  }

  const image = images[ imageOption.index ];

  if ( !image ) {
    return;
  }

  const imagePosition = createVector(
    width * imageOption.position.x,
    height * imageOption.position.y
  );

  imageUtils.marginImage( {
    position: imagePosition,
    center: imageOption.center ?? true,
    margin: imageOption.margin ?? 80,
    scale: imageOption.scale,
    img: image.img
  } );
}