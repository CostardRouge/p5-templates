import options from "../../utils/options.js";

import grid from "../../utils/grid.js";
import cache from "../../utils/cache.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";
import * as common from "../../utils/common.js";

const canvases = {
};

sketch.setup(
  () => {
    canvases.background = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    // canvases.background.pixelDensity(options.backgroundPixelDensity || 0.0175);

    background( ...( options.sketch?.backgroundColor ?? options.colors.background ) );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

sketch.draw( (
  time, center, favoriteColor
) => {
  const bg = options.sketch?.backgroundColor ?? options.colors.background;
  const textColor = options.sketch?.textColor ?? options.colors.text;
  background( ...bg );
  canvases.background.background( ...bg );

  const imagesFromOptions = options.sketch?.images && options.sketch.images.length
    ? options.sketch.images
    : null;
  const images = imagesFromOptions
    ? imagesFromOptions.map( ( p ) => common.getAsset( p ) ).filter( Boolean )
    : cache.get( "images" );

  const borderSize = 0;
  const rows = options.sketch?.rows ?? 4;// columns*height/width;
  const columns = options.sketch?.columns ?? 3;// rows*width/height;
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
    centered: false
  };
  const {
    cells: gridCells
  } = grid.create( gridOptions );

  canvases.background.background( ...bg );
  canvases.background.background(
    0,
    0,
    0,
    92
  );

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

  if (!imageAtIndex) {
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
        width: W
      },
      center: true,
      fill: true,
      scale: .9,
      clip: true,
      margin: 10,
    } );
  } );

  const defaultTitle = options.name.replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      ( options.sketch?.title || defaultTitle ),
      0,
      height / 2,
      {
        size: options.sketch?.titleSize ?? 128,
        stroke: color( ...textColor ),
        fill: color( ...bg ),
        font: string.fonts?.[ options.sketch?.font ] || string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }
} );
