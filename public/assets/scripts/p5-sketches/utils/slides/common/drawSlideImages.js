import {
  common, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideImages(
  imagesOptions, slideOptions
) {
  const images = common.getAssets( slideOptions );

  if ( !images || !images.length ) {
    return;
  }

  for ( const imageAsset of images ) {
    imageUtils.marginImage( {
      center: imagesOptions.center ?? true,
      margin: imagesOptions.margin ?? 80,
      img: imageAsset.img
    } );
  }
}