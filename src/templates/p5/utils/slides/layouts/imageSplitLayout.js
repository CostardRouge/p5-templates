import {
  getAssets
} from "../../common.js";

export default function imageSplitLayout( opts ) {
  const [
    a,
    b
  ] = getAssets( opts );

  if ( a ) {
    image(
      a.img,
      0,
      0,
      p.width / 2,
      height
    );
  }
  if ( b ) {
    image(
      b.img,
      p.width / 2,
      0,
      p.width / 2,
      height
    );
  }
}
