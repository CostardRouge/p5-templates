import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import renderTitle from "@/p5/utils/title/renderTitle";

const canvases = {
};

sketch.setup( () => {
  canvases.background = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height
  );

  // canvases.background.pixelDensity(options.backgroundPixelDensity || 0.0175);

  background( ...options.sketch.backgroundColor );

  canvases.background.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  clear();
  background( ...options.sketch.backgroundColor );

  canvases.background.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  const borderSize = 0;
  const rows = options.sketch?.rows ?? 4; // columns*height/width;
  const columns = options.sketch?.columns ?? 3; // rows*width/height;
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

  canvases.background.background( ...options.sketch.backgroundColor );

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
  //         position: createVector(x+W/2, y+H/2),
  //         boundary: {
  //             height: H/2,
  //             width: W/2
  //         },
  //         graphics: canvases.background,
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
    position: createVector(
      width / 2,
      height / 2
    ),
    graphics: canvases.background,
    center: true,
    fill: true,
  } );

  image(
    canvases.background,
    0,
    0,
    width,
    height
  );
  // filter( BLUR, options.sketch?.blur ?? 9, true );
  // filter(POSTERIZE, options.blur || 9, true);

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
      position: createVector(
        x + W / 2,
        y + H / 2
      ),
      boundary: {
        height: H,
        width: W,
      },
      center: true,
      // fill: true,
      scale: 1,
      clip: true,
      margin: 10,
    } );
  } );

  renderTitle();
} );
