import {
  common
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function imageGridLayout( opts ) {
  const imgs = common.getAssets( opts ).slice(
    0,
    4
  );

  imgs.forEach( (
    o, i
  ) => {
    const x = ( i % 2 ) * width / 2;
    const y = Math.floor( i / 2 ) * height / 2;

    image(
      o.img,
      x,
      y,
      width / 2,
      height / 2
    );
  } );
}