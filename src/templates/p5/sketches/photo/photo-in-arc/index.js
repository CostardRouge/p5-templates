import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import renderTitle from "../../../utils/title/renderTitle";
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
  const arcConfig = options.sketch?.arc ?? {
  };
  const imageConfig = options.sketch?.image ?? {
  };
  const debugConfig = options.sketch?.debug ?? {
  };

  const circlePosition = p.createVector(
    ( arcConfig.anchorX ?? 0.5 ) * p.width,
    ( arcConfig.anchorY ?? 0.75 ) * p.height
  );

  const radiusX = ( arcConfig.radiusX ?? 0.5 ) * p.height;
  const radiusY = ( arcConfig.radiusY ?? 0.5 ) * p.width;

  const startAngle = p.radians( arcConfig.startAngle ?? 270 );
  const endAngle = p.radians( arcConfig.endAngle ?? 90 );

  if ( images?.length ) {
    for ( let i = 0; i < images.length; i++ ) {
      const t = images.length > 1 ? i / ( images.length - 1 ) : 0;
      const angle = p.map(
        t,
        0,
        1,
        startAngle,
        endAngle
      );

      const imageObjectAtIndex = images[ i ];
      const imageAtIndex = imageObjectAtIndex.img ?? imageObjectAtIndex;

      const imagePosition = circlePosition.copy();

      imagePosition.add(
        Math.sin( angle ) * radiusX,
        Math.cos( angle ) * radiusY
      );

      imageUtils.marginImage( {
        img: imageAtIndex,
        position: imagePosition,
        scale: imageConfig.scale ?? 0.5,
        center: imageConfig.center ?? true,
      } );

      if ( debugConfig.showPoints ) {
        p.stroke( ...( debugConfig.pointColor ?? [
          255,
          0,
          0
        ] ) );
        p.strokeWeight( debugConfig.pointWeight ?? 20 );
        p.point(
          imagePosition.x,
          imagePosition.y
        );
      }
    }
  }

  renderTitle();
} );
