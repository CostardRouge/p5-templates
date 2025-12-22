import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import renderTitle from "../../../utils/title/renderTitle";

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );
} );

sketch.draw( () => {
  clear();
  background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();
  const arcConfig = options.sketch?.arc ?? {
  };
  const imageConfig = options.sketch?.image ?? {
  };
  const debugConfig = options.sketch?.debug ?? {
  };

  const circlePosition = createVector(
    ( arcConfig.anchorX ?? 0.5 ) * width,
    ( arcConfig.anchorY ?? 0.75 ) * height
  );

  const radiusX = ( arcConfig.radiusX ?? 0.5 ) * height;
  const radiusY = ( arcConfig.radiusY ?? 0.5 ) * width;

  const startAngle = radians( arcConfig.startAngle ?? 270 );
  const endAngle = radians( arcConfig.endAngle ?? 90 );

  if ( images?.length ) {
    for ( let i = 0; i < images.length; i++ ) {
      const t = images.length > 1 ? i / ( images.length - 1 ) : 0;
      const angle = map(
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
        stroke( ...( debugConfig.pointColor ?? [
          255,
          0,
          0
        ] ) );
        strokeWeight( debugConfig.pointWeight ?? 20 );
        point(
          imagePosition.x,
          imagePosition.y
        );
      }
    }
  }

  renderTitle();
} );
