import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = {};

sketch.setup( () => {
  const p = getP5();

  canvases.blurredLayer = p.createGraphics(
    p.width,
    p.height
  );

  // canvases.background.pixelDensity(options.backgroundPixelDensity || 0.0175);

  p.background( ...options.sketch.backgroundColor );

  canvases.blurredLayer.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  canvases.blurredLayer.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const borderSize = 0;
  const rows = options.sketch?.rows ?? 4; // columns*p.height/p.width;
  const columns = options.sketch?.columns ?? 3; // rows*p.width/p.height;
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
  } = grid.create( gridOptions );

  canvases.blurredLayer.background( ...options.sketch.backgroundColor );

  // gridCells.forEach( ({ position, xIndex, yIndex, width: W, height: H }) => {
  //     const { x, y } = position;
  //     const imageObjectAtIndex = mappers.circularIndex(
  //         (
  //             +animation.progression*images.length
  //             +(
  //                 +xIndex/columns
  //                 +yIndex/rows
  //             )
  //         ),
  //         images
  //     );
  //     const imageAtIndex = imageObjectAtIndex.img;
  //
  //     imageUtils.marginImage({
  //         img: imageAtIndex,
  //         position: p.createVector(x+W/2, y+H/2),
  //         boundary: {
  //             height: H/2,
  //             width: W/2
  //         },
  //         graphics: canvases.blurredLayer,
  //         center: true,
  //     });
  // });

  const imageObjectAtIndex = mappers.circularIndex(
    animation.progression * images.length,
    images
  );
  const imageAtIndex = imageObjectAtIndex?.img;

  if ( !imageAtIndex ) {
    return;
  }

  imageUtils.marginImage( {
    img: imageAtIndex,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    graphics: canvases.blurredLayer,
    center: true,
    fill: true
  } );

  p.image(
    canvases.blurredLayer,
    0,
    0,
    p.width,
    p.height
  );
  p.filter(
    p.BLUR,
    options.sketch?.blur ?? 9,
    true
  );
  p.filter(
    p.POSTERIZE,
    options.sketch.posterize ?? 9,
    true
  );

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
      // (
      //     +animation.progression*images.length
      //     +(
      //         +xIndex/columns
      //         +yIndex/rows
      //     )
      // ),
      images
    );

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
      // fill: true,
      scale: 1,
      clip: true,
      margin: 10
    } );
  } );
} );
