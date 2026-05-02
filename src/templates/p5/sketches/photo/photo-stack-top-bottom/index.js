import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  _time, center, favoriteColor
) => {
  const p = getP5();
  // options.colors.text = [252, 209, 83]
  // blendMode(HARD_LIGHT);

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const imageIndexDisplay = p.map(
    animation.triangleProgression( 2 ),
    0,
    1,
    0,
    images.length
  );

  // Calculate step size for vertical positioning
  const margin = p.width * options.sketch?.margin;
  const availableVerticalSpace = p.height - 2 * margin;
  const step = availableVerticalSpace / ( images.length - 1 || 1 );

  for ( let i = 0; i < images.length; i++ ) {
    if ( imageIndexDisplay < i ) {
      return;
    }

    const {
      img
    } = images[ i ];
    const y = margin + i * step;

    imageUtils.marginImage( {
      position: p.createVector(
        p.width / 2,
        y
      ),
      margin,
      scale: options.sketch?.scale ?? 0.8,
      center: options.sketch?.center ?? true,
      clip: options.sketch?.clip ?? false,
      fill: options.sketch?.fill ?? true,
      img,
    } );
  }
} );
