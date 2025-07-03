import {
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function imageFullLayout( opts ) {
  const img = common.getAssets( opts )[ 0 ];

  if ( img ) {
    image(
      img.img,
      0,
      0,
      width,
      height
    );
  }
}