import {
  getAssets
} from "../../common.js";

export default function imageFullLayout( opts ) {
  const img = getAssets( opts )[ 0 ];

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
