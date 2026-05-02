import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  if ( !images?.length ) {
    return;
  }

  // Which image to show this frame
  const imageIndex = Math.floor( animation.progression * images.length ) % images.length;
  const imageAtIndex = images?.[ imageIndex ]?.img;

  imageUtils.marginImage( {
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    margin: p.width * options.sketch?.margin,
    scale: options.sketch?.scale ?? 1,
    center: options.sketch?.center ?? true,
    clip: options.sketch?.clip ?? false,
    fill: options.sketch?.fill ?? true,
    img: imageAtIndex,
  } );

  renderTitle();
} );
