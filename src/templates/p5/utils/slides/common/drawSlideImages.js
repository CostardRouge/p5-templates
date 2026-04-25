import {
  getAssets
} from "../../common.js";
import imageUtils from "../../imageUtils.js";

export default function drawSlideImages(
  imagesOptions, slideOptions
) {
  const images = getAssets( slideOptions );

  if ( !images || !images.length ) {
    return;
  }

  for ( const imageAsset of images ) {
    imageUtils.marginImage( {
      center: imagesOptions.center ?? true,
      margin: imagesOptions.margin ?? 80,
      img: imageAsset.img,
    } );
  }
}
