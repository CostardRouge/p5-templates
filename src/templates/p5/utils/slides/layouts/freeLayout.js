import drawSlideVisual from "../common/drawSlideVisual.js";
import drawSlideMeta from "../common/drawSlideMeta.js";
import drawSlideSpecs from "../common/drawSlideSpecs.js";
import drawSlideHud from "../common/drawSlideHud.js";
import drawSlideText from "../common/drawSlideText.js";
import drawSlideImage from "../common/drawSlideImage.js";
import drawSlideImages from "../common/drawSlideImages.js";
import drawSlideBackground from "../common/drawSlideBackground.js";
import drawSlideImagesStack from "../common/drawSlideImagesStack.js";
import drawSlideQrCode from "../common/drawSlideQrCode.js";
import {
  resolveDraggedItem
} from "../contentDrag.js";
import {
  beginItemBounds,
  endItemBounds
} from "../common/itemBoundsRegistry.js";

// `scope` says which content list is being rendered ("global" or "slide:<n>")
// so an in-flight on-canvas drag (see contentDrag.js) can substitute the live
// position of the grabbed item without touching the option store every frame.
// Each item's render is bracketed with begin/endItemBounds so the renderer's
// reportItemBounds() call lands on the right (scope, index) — that visible
// rectangle is what the drag layer hit-tests.
export default function freeLayout(
  options, scope
) {
  options?.content?.forEach( (
    rawItem, index
  ) => {
    const item = resolveDraggedItem(
      scope,
      index,
      rawItem
    );

    beginItemBounds(
      scope,
      index
    );

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
      case "hud":
        drawSlideHud( item );
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

    endItemBounds();
  } );
}
