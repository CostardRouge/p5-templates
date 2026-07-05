import {
  getAssets
} from "../../common.js";
import {
  getP5
} from "../../sketch.js";

export default function imageFullLayout( opts ) {
  const p = getP5();
  const img = getAssets( opts )[ 0 ];

  if ( img ) {
    p.image(
      img.img,
      0,
      0,
      p.width,
      p.height
    );
  }
}
