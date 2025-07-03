import {
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function imageStripLayout( opts ) {
  const imgs = common.getAssets( opts );
  const h = height / imgs.length;

  imgs.forEach( (
    o, i
  ) => image(
    o.img,
    0,
    i * h,
    width,
    h
  ) );
}