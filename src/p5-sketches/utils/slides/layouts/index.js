import freeLayout from "./freeLayout.js";
import imageStripLayout from "./imageStripLayout.js";
import imageFullLayout from "./imageFullLayout.js";
import imageGridLayout from "./imageGridLayout.js";
import imageSplitLayout from "./imageSplitLayout.js";
import imagePolaroidLayout from "./imagePolaroidLayout.js";

function autoLayout( slideOptions ) {
  const n = slideOptions?.images?.length ?? 0;

  if ( n === 1 ) {
    return "full";
  }

  if ( n === 2 ) {
    return "split";
  }

  if ( n <= 4 ) {
    return "grid2x2";
  }

  return "strip";
}

export const _layouts = {
  auto: autoLayout,
  free: freeLayout,
  full: imageFullLayout,
  strip: imageStripLayout,
  split: imageSplitLayout,
  grid2x2: imageGridLayout,
  polaroid: imagePolaroidLayout
};