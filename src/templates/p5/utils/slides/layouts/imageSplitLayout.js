import {
  getAssets
} from "../../common.js";
import {
  getP5
} from "../../sketch.js";

export default function imageSplitLayout( opts ) {
  const p = getP5();
  const [
    a,
    b
  ] = getAssets( opts );

  if ( a ) {
    p.image(
      a.img,
      0,
      0,
      p.width / 2,
      p.height
    );
  }
  if ( b ) {
    p.image(
      b.img,
      p.width / 2,
      0,
      p.width / 2,
      p.height
    );
  }
}
