import {
  getAssets
} from "../../common.js";

export default function imageStripLayout( opts ) {
  const imgs = getAssets( opts );
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