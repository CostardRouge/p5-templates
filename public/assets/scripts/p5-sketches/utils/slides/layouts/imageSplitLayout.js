import {
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function imageSplitLayout( opts ) {
  const [
    a,
    b
  ] = common.getAssets( opts );

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