import {
  getAssets
} from "../../common.js";
import {
  getP5
} from "../../sketch.js";

export default function imageGridLayout( opts ) {
  const p = getP5();
  const imgs = getAssets( opts ).slice(
    0,
    4
  );

  imgs.forEach( (
    o, i
  ) => {
    const x = ( ( i % 2 ) * p.width ) / 2;
    const y = ( Math.floor( i / 2 ) * p.height ) / 2;

    p.image(
      o.img,
      x,
      y,
      p.width / 2,
      p.height / 2
    );
  } );
}
