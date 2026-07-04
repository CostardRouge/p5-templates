import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( async(
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const borderSize = options.sketch?.grid?.borderSize ?? 0;
  const rows = options.sketch?.grid?.rows || 3; // columns*p.height/p.width;
  const columns = options.sketch?.grid?.columns || 3; // rows*p.width/p.height;
  const gridOptions = {
    topLeft: p.createVector(
      borderSize,
      borderSize
    ),
    topRight: p.createVector(
      p.width - borderSize,
      borderSize
    ),
    bottomLeft: p.createVector(
      borderSize,
      p.height - borderSize
    ),
    bottomRight: p.createVector(
      p.width - borderSize,
      p.height - borderSize
    ),
    rows,
    columns,
    centered: false
  };
  const {
    cells: gridCells
  } = await grid.create( gridOptions );

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
      position: p.createVector(
        x + W / 2,
        y + H / 2
      ),
      boundary: {
        height: H,
        width: W
      },
      center: true,
      fill: true,
      scale: 0.8,
      clip: true
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
    scale: 0.8
  } );
} );
