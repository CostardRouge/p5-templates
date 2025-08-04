import neonGraffiti from "../../visuals/neonGraffiti.js";

import drawSlideMeta from "../common/drawSlideMeta.js";
import drawSlideText from "../common/drawSlideText.js";
import drawSlideImage from "../common/drawSlideImage.js";
import drawSlideImages from "../common/drawSlideImages.js";
import drawSlideBackground from "../common/drawSlideBackground.js";
import drawSlideImagesStack from "../common/drawSlideImagesStack.js";

export default function freeLayout( options ) {
  options.content.forEach( ( item ) => {
    switch ( item?.type ) {
      case "background":
        drawSlideBackground( item );
        break;
      case "meta":
        drawSlideMeta( item );
        break;
      case "text":
        drawSlideText( item );
        break;
      case "images":
        drawSlideImages(
          item,
          options
        );
        break;
      case "image":
        drawSlideImage(
          item,
          options
        );
        break;
      case "images-stack":
        drawSlideImagesStack(
          item,
          options
        );
        break;
    }
  } );
  // neonGraffiti( {
  //   start: createVector(
  //     0,
  //     height * options.neonGraffiti.startHeight
  //   ),
  //   end: createVector(
  //     width,
  //     height * options.neonGraffiti.endHeight
  //   ),
  //   amplitude: options.neonGraffiti.amplitude,
  //   innerCircleSize: options.neonGraffiti.innerCircleSize,
  //   shadowsCount: options.neonGraffiti.shadowsCount,
  //   stepAngleAmplitude: options.neonGraffiti.stepAngleAmplitude
  // } );
}