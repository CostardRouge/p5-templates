import options from "../../utils/options.js";

import grid from "../../utils/grid.js";
import cache from "../../utils/cache.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import colors from "../../utils/colors.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import * as common from "../../utils/common";

// helpers
const getBg = () => (
  options.sketch?.backgroundColor ??
  options.colors?.background ??
  [
    0,
    0,
    0
  ]
);

const getTextColor = () => (
  options.sketch?.textColor ??
  options.colors?.text ??
  [
    0
  ]
);

const getFont = () => (
  string.fonts?.[ options.sketch?.font ] || string.fonts.martian
);

const getImages = () => {
  const imagesFromOptions =
    options.sketch?.images && options.sketch.images.length
      ? options.sketch.images
      : null;

  const fromCache = cache.get( "images" );

  return imagesFromOptions
    ? imagesFromOptions.map( ( p ) => common.getAsset( p ) ).filter( Boolean )
    : fromCache || [
    ];
};

sketch.setup(
  () => {
    background( ...getBg() );
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

function getImagePart(
  img, x, y, w, h
) {
  let imgAspect = img.width / img.height;
  let canvasAspect = width / height;

  let displayW, displayH;

  if ( imgAspect > canvasAspect ) {
    // Image is wider than canvas, fit to width
    displayW = width;
    displayH = width / imgAspect;
  } else {
    // Image is taller than canvas, fit to height
    displayH = height;
    displayW = height * imgAspect;
  }

  let offsetX = ( width - displayW ) / 2;
  let offsetY = ( height - displayH ) / 2;

  return img.get(
    ( x - offsetX ) / displayW * img.width,
    ( y - offsetY ) / displayH * img.height,
    ( w / displayW ) * img.width,
    ( h / displayH ) * img.height
  );
}

sketch.draw( (
  time, center, favoriteColor
) => {
  background(
    ...getBg(),
    20
  );

  // const sizes = [8, 16, 2, 9, 3, 4];
  // const columns = mappers.circularIndex(time/2, sizes);
  // const rows = mappers.circularIndex(time/2, sizes.reverse());
  const rows = options.sketch?.rows ?? 16;// columns*height/width;
  const columns = options.sketch?.columns ?? 9;// rows*width/height;
  const borderSize = options.sketch?.borderSize ?? 0;
  const images = getImages();

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

  const W = width / columns;
  const H = height / rows;

  const {
    cells: gridCells
  } = grid.create( gridOptions );

  const imagePaths = images.map( ( {
    path
  } ) => path ).join( "-" );

  const imageParts = cache.store(
    `image-parts-${ columns }-${ rows }-${ imagePaths }`,
    () => (
      images.map( ( {
        img
      } ) => (
        gridCells.reduce(
          (
            imageCells, {
              x, y
            }
          ) => {
            const imagePart = getImagePart(
              img,
              x,
              y,
              W,
              H
            );

            imageCells.push( {
              imagePart,
              dominantColor: colors.getDominantColor(
                imagePart,
                options.sketch?.dominantColorSample ?? 50
              )
            } );

            return imageCells;
          },
          [
          ]
        )
      ) )
    )
  );

  const imageIndexes = imageParts.map( (
    _, index
  ) => [
    index,
    index
  ] ).flat( Infinity );

  gridCells.forEach( (
    {
      position, xIndex, yIndex
    }, cellIndex
  ) => {
    const {
      x, y
    } = position;
    const switchIndex = (
      // -cellIndex/(columns*rows)
      // +mappers.circularIndex(time, [-xIndex, xIndex])/columns
      // +mappers.circularIndex(time, [-yIndex, yIndex])/rows
      //
      +noise(
        xIndex / columns,
        yIndex / rows,
        animation.circularProgression
      )
			+ xIndex / columns
			+ yIndex / rows
			// +x/width
			// +y/height
    );
    const imageIndex = mappers.circularIndex(
      (
        0
				+ animation.progression * imageIndexes.length
				+ switchIndex
      ),
      imageIndexes
    );

    const imageAtIndex = imageParts?.[ ~~imageIndex ];

    if ( !imageAtIndex ) {
      return;
    }

    const {
      imagePart, dominantColor
    } = imageAtIndex?.[ ~~cellIndex ];

    if ( imagePart ) {
      const veil = mappers.circularIndex(
        animation.progression * sketch.sketchOptions.animation.duration + switchIndex,
        [
          1,
          0
        ]
      );

      if ( dominantColor && veil ) {
        const {
          levels: [
            r,
            g,
            b
          ]
        } = dominantColor;

        strokeWeight( 1 );
        fill(
          r,
          g,
          b,
          190
        );
        stroke(
          r,
          g,
          b,
          255
        );
        // stroke(color(230))
        // noStroke()

        rect(
          x,
          y,
          W,
          H
        );
      }
      else {
        image(
          imagePart,
          x,
          y,
          W,
          H
        );

        noFill();
        noStroke();
        // strokeWeight(1/4)
        // stroke(favoriteColor)
        // strokeWeight(1)
        // stroke(color(230))
        rect(
          x,
          y,
          W,
          H
        );
      }

      // strokeWeight(1)
      // cross(x + W - 30, y + H - 30, 20)

      // const II = round(imageIndex);

      // string.write(`D${II}`, x+18, y+30, {
      //   size: 18,
      //   stroke: 0,
      //   strokeWeight: 2,
      //   fill: favoriteColor,
      //   font: string.fonts.openSans
      // })

      // string.write(`${xIndex}`, x+W-30, y+30, {
      //   size: 18,
      //   stroke: 0,
      //   strokeWeight: 2,
      //   fill: favoriteColor,
      //   font: string.fonts.openSans
      // })
      //
      // string.write(`${cellIndex}`, x+W-30, y+H, {
      //   size: 18,
      //   stroke: 0,
      //   textAlign: [CENTER, CENTER],
      //   strokeWeight: 1,
      //   fill: favoriteColor,
      //   font: string.fonts.openSans
      // })
    }
  } );

  if ( animation.progression < 0.2 ) {
    string.write(
      options.sketch?.title || options?.name,
      0,
      height / 2,
      {
        size: 172,
        stroke: color( ...getTextColor() ),
        fill: color( ...getBg() ),
        font: getFont(),
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }
} );
