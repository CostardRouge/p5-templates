import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle";

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  clear();
  background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const borderSize = options.sketch?.grid?.borderSize ?? 0;
  const rows = options.sketch?.grid?.rows || 3; // columns*height/width;
  const columns = options.sketch?.grid?.columns || 3; // rows*width/height;
  const gridOptions = {
    topLeft: createVector(
      borderSize,
      borderSize
    ),
    topRight: createVector(
      width - borderSize,
      borderSize
    ),
    bottomLeft: createVector(
      borderSize,
      height - borderSize
    ),
    bottomRight: createVector(
      width - borderSize,
      height - borderSize
    ),
    rows,
    columns,
    centered: false,
  };
  const {
    cells: gridCells
  } = grid.create( gridOptions );

  gridCells.forEach( (
    {
      position, xIndex, yIndex, width: W, height: H
    }, cellIndex
  ) => {
    const {
      x, y
    } = position;

    const imageObjectAtIndex = mappers.circularIndex(
      cellIndex,
      images
    );

    if ( !imageObjectAtIndex ) {
      return;
    }

    const imageAtIndex = imageObjectAtIndex.img;

    imageUtils.marginImage( {
      img: imageAtIndex,
      position: createVector(
        x + W / 2,
        y + H / 2
      ),
      boundary: {
        height: H,
        width: W,
      },
      center: true,
      fill: true,
      scale: 0.8,
      clip: true,
    } );
  } );

  const imageObjectAtIndex = mappers.circularIndex(
    animation.progression * images.length,
    images
  );

  if ( !imageObjectAtIndex ) {
    return;
  }

  const imageAtIndex = imageObjectAtIndex.img;

  imageUtils.marginImage( {
    img: imageAtIndex,
    center: true,
    fill: true,
    scale: 0.8,
  } );

  renderTitle();
} );
