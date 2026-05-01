import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = {
  buffer: null
};

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );

  sketchState.buffer = graphics.createAutoResizableGraphics(
    p.width,
    p.height
  );
} );

sketch.draw( async(
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const rows = options.sketch.grid.rows ?? 16; // columns*p.height/p.width;
  const columns = options.sketch.grid.columns ?? 9; // rows*p.width/p.height;
  const borderSize = options.sketch.grid.borderSize ?? 16;
  // const dominantColorSample = options.sketch.dominantColorSample ?? 50;

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
    centered: true,
  };

  const W = p.width / columns;
  const H = p.height / rows;

  const {
    cells: gridCells
  } = await grid.create( gridOptions );

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

  p.noFill();
  p.stroke( favoriteColor );

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
      +p.noise(
        xIndex,
        yIndex,
        timeIndex
      ) +
      p.noise(
        x / p.width,
        y / p.height,
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
      p.image(
        imagePart,
        x,
        y,
        W + 1,
        H + 1
      );
      // p.rect(x, y, W, H)
    }
  } );
} );
