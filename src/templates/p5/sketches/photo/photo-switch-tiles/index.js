import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

const sketchState = {
  buffer: null
};

sketch.setup( () => {
  background( ...options.sketch.backgroundColor );

  sketchState.buffer = graphics.createAutoResizableGraphics(
    width,
    height
  );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  clear();
  background( ...options.sketch.backgroundColor );

  const rows = options.sketch.grid.rows ?? 16; // columns*height/width;
  const columns = options.sketch.grid.columns ?? 9; // rows*width/height;
  const borderSize = options.sketch.grid.borderSize ?? 16;
  // const dominantColorSample = options.sketch.dominantColorSample ?? 50;

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
    centered: true,
  };

  const W = width / columns;
  const H = height / rows;

  const {
    cells: gridCells
  } = grid.create( gridOptions );

  const images = imageUtils.getImages();
  const imageFingerprints = images.reduce(
    (
      accumulator, image
    ) => {
      if ( image.img ) {
        accumulator.push( `${ image.path }-${ image.filename }` );
      }

      return accumulator;
    },
    [
    ]
  );

  console.log( imageFingerprints );

  if ( imageFingerprints.length === 0 ) {
    return;
  }

  const imageParts = cache.store(
    cache.key(
      columns,
      rows,
      borderSize,
      imageFingerprints.join( "i" ),
      // dominantColorSample
    ),
    () => {
      console.log( "new" );
      return images.map( ( {
        img
      } ) => {
        imageUtils.marginImage( {
          img,
          graphics: sketchState.buffer,
          center: true,
          fill: true,
        } );

        return gridCells.reduce(
          (
            imageCells, {
              x, y
            }
          ) => {
            const imagePart = sketchState.buffer.get(
              x,
              y,
              W,
              H
            );

            imageCells.push( {
              imagePart,
              // dominantColor: colors.getDominantColor( imagePart, 500 )
            } );

            return imageCells;
          },
          [
          ]
        );
      } );
    }
  );

  const imageIndexes = imageParts
    .map( (
      _, index
    ) => [
      index
    ] )
    .flat( Infinity );

  noFill();
  stroke( favoriteColor );

  gridCells.forEach( (
    {
      position, xIndex, yIndex
    }, cellIndex
  ) => {
    const {
      x, y
    } = position;

    const timeIndex = animation.progression * imageIndexes.length;

    const switchIndex =
      +noise(
        xIndex,
        yIndex,
        timeIndex
      ) +
      noise(
        x / width,
        y / height,
        cellIndex
      );
    const imageIndex = mappers.circularIndex(
      timeIndex + switchIndex, //* gridCells.length
      imageIndexes
    );

    const imageAtIndex = imageParts?.[ ~~imageIndex ];
    const {
      imagePart
    } = imageAtIndex?.[ ~~cellIndex ];

    if ( imagePart ) {
      image(
        imagePart,
        x,
        y,
        W + 1,
        H + 1
      );
      // rect(x, y, W, H)
    }
  } );
} );
