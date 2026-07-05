import {
  getAssets
} from "../../common.js";
import {
  getP5
} from "../../sketch.js";

export default function imagePolaroidLayout( opts ) {
  const p = getP5();
  const imgs = getAssets( opts );
  const w = p.width / 2;
  const h = ( w * 4 ) / 3;

  imgs.forEach( (
    o, i
  ) => {
    const x = 40 + i * ( w + 40 );
    const y = p.height / 2 - h / 2;

    p.push();
    p.translate(
      x + w / 2,
      y + h / 2
    );
    p.rotate( p.radians( -5 + 10 * i ) );
    p.translate(
      -w / 2,
      -h / 2
    );
    p.fill( 255 );
    p.noStroke();
    p.rect(
      0,
      0,
      w,
      h + 20,
      10
    );
    p.image(
      o.img,
      10,
      10,
      w - 20,
      h - 30
    );
    p.pop();
  } );
}
