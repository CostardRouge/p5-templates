import drawSlideVisual from "../common/drawSlideVisual.js";
import drawSlideMeta from "../common/drawSlideMeta.js";
import drawSlideSpecs from "../common/drawSlideSpecs.js";
import drawSlideText from "../common/drawSlideText.js";
import drawSlideImage from "../common/drawSlideImage.js";
import drawSlideImages from "../common/drawSlideImages.js";
import drawSlideBackground from "../common/drawSlideBackground.js";
import drawSlideImagesStack from "../common/drawSlideImagesStack.js";
import drawSlideQrCode from "../common/drawSlideQrCode.js";

export default function freeLayout( options ) {
  options?.content?.forEach( ( item ) => {
    switch ( item?.type ) {
      case "background":
        drawSlideBackground( item );
        break;
      case "meta":
        drawSlideMeta( item );
        break;
      case "specs":
        drawSlideSpecs( item );
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
      case "visual":
        drawSlideVisual(
          item,
          options
        );
        break;
      case "qrcode":
        drawSlideQrCode(
          item,
          options
        );
        break;
    }
  } );
}
