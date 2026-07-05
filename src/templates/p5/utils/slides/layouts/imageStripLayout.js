import {
  getAssets
} from "../../common.js";
import {
  getP5
} from "../../sketch.js";

export default function imageStripLayout( opts ) {
  const p = getP5();
  const imgs = getAssets( opts );
  const h = p.height / imgs.length;

  imgs.forEach( (
    o, i
  ) => p.image(
    o.img,
    0,
    i * h,
    p.width,
    h
  ) );
}
