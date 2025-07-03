import {
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function imagePolaroidLayout( opts ) {
  const imgs = common.getAssets( opts );
  const w = width / 2;
  const h = w * 4 / 3;

  imgs.forEach( (
    o, i
  ) => {
    const x = 40 + i * ( w + 40 );
    const y = height / 2 - h / 2;

    push();
    translate(
      x + w / 2,
      y + h / 2
    );
    rotate( radians( -5 + 10 * i ) );
    translate(
      -w / 2,
      -h / 2
    );
    fill( 255 );
    noStroke();
    rect(
      0,
      0,
      w,
      h + 20,
      10
    );
    image(
      o.img,
      10,
      10,
      w - 20,
      h - 30
    );
    pop();
  } );
}