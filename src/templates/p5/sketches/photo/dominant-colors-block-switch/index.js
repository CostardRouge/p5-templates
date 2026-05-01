import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import * as common from "@/p5/utils/common.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

// helpers
const getBg = () =>
  options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0,
    0,
    0
  ];

const getTextColor = () =>
  options.sketch?.textColor ?? options.colors?.text ?? [
    0
  ];

const getFont = () =>
  string.fonts?.[ options.sketch?.font ] || string.fonts.martian;

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

sketch.setup( () => {
  const p = getP5();

  p.background( ...getBg() );
} );

function getImagePart(
  img, x, y, w, h
) {
  const p = getP5();

  let imgAspect = img.width / img.height;
  let canvasAspect = p.width / p.height;

  let displayW, displayH;

  if ( imgAspect > canvasAspect ) {
    // Image is wider than canvas, fit to p.width
    displayW = p.width;
    displayH = p.width / imgAspect;
  } else {
    // Image is taller than canvas, fit to p.height
    displayH = p.height;
    displayW = p.height * imgAspect;
  }

  let offsetX = ( p.width - displayW ) / 2;
  let offsetY = ( p.height - displayH ) / 2;

  return img.get(
    ( ( x - offsetX ) / displayW ) * img.width,
    ( ( y - offsetY ) / displayH ) * img.height,
    ( w / displayW ) * img.width,
    ( h / displayH ) * img.height
  );
}

sketch.draw( async(
  time, center, favoriteColor
) => {
  const p = getP5();

  p.background(
    ...getBg(),
    20
  );

  // const sizes = [8, 16, 2, 9, 3, 4];
  // const columns = mappers.circularIndex(time/2, sizes);
  // const rows = mappers.circularIndex(time/2, sizes.reverse());
  const rows = options.sketch?.rows ?? 16; // columns*p.height/p.width;
  const columns = options.sketch?.columns ?? 9; // rows*p.width/p.height;
  const borderSize = options.sketch?.borderSize ?? 0;
  const images = getImages();

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
    centered: false,
  };

  const W = p.width / columns;
  const H = p.height / rows;

  const {
    cells: gridCells
  } = await grid.create( gridOptions );

  const imagePaths = images.map( ( {
    path
  } ) => path ).join( "-" );

  const imageParts = cache.store(
    `image-parts-${ columns }-${ rows }-${ imagePaths }`,
    () =>
      images.map( ( {
        img
      } ) =>
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
              ),
            } );

            return imageCells;
          },
          [
          ]
        ) )
  );

  const imageIndexes = imageParts
    .map( (
      _, index
    ) => [
      index,
      index
    ] )
    .flat( Infinity );

  gridCells.forEach( (
    {
      position, xIndex, yIndex
    }, cellIndex
  ) => {
    const {
      x, y
    } = position;
    const switchIndex =
      // -cellIndex/(columns*rows)
      // +mappers.circularIndex(time, [-xIndex, xIndex])/columns
      // +mappers.circularIndex(time, [-yIndex, yIndex])/rows
      //
      +p.noise(
        xIndex / columns,
        yIndex / rows,
        animation.circularProgression
      ) +
      xIndex / columns +
      yIndex / rows;
    // +x/p.width
    // +y/p.height
    const imageIndex = mappers.circularIndex(
      0 + animation.progression * imageIndexes.length + switchIndex,
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
        animation.progression * sketch.sketchOptions.animation.duration +
          switchIndex,
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
          ],
        } = dominantColor;

        p.strokeWeight( 1 );
        p.fill(
          r,
          g,
          b,
          190
        );
        p.stroke(
          r,
          g,
          b,
          255
        );
        // p.stroke(p.color(230))
        // p.noStroke()

        p.rect(
          x,
          y,
          W,
          H
        );
      } else {
        p.image(
          imagePart,
          x,
          y,
          W,
          H
        );

        p.noFill();
        p.noStroke();
        // p.strokeWeight(1/4)
        // p.stroke(favoriteColor)
        // p.strokeWeight(1)
        // p.stroke(p.color(230))
        p.rect(
          x,
          y,
          W,
          H
        );
      }

      // p.strokeWeight(1)
      // cross(x + W - 30, y + H - 30, 20)

      // const II = p.round(imageIndex);

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
      //   textAlign: [p.CENTER, p.CENTER],
      //   strokeWeight: 1,
      //   fill: favoriteColor,
      //   font: string.fonts.openSans
      // })
    }
  } );

  renderTitle();
} );
