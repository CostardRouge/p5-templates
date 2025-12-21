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
      width / 2,
      height
    );
  }
  if ( b ) {
    image(
      b.img,
      width / 2,
      0,
      width / 2,
      height
    );
  }
}
