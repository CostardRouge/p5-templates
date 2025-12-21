import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

sketch.setup( () => {
  background( ...options.colors.background );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  const images = cache.get( "images" );

  const borderSize = 0;
  const rows = options.rows || 3; // columns*height/width;
  const columns = options.columns || 3; // rows*width/height;
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
  const imageAtIndex = imageObjectAtIndex.img;

  imageUtils.marginImage( {
    img: imageAtIndex,
    position: createVector(
      width / 2,
      height / 2
    ),
    // graphics: canvases.background,
    center: true,
    fill: true,
    scale: 0.5,
    // clip: true,
  } );

  const defaultTitle = options.name.replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      0,
      height / 2,
      {
        size: 128,
        stroke: color( ...options.colors.text ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION,
      }
    );
  }
} );
