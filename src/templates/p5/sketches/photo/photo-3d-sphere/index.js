import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
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
    : fromCache || [];
};

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const borderSize = 0;

sketch.draw( async(
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();

  if ( options.sketch?.variableBackgroundColor ) {
    const backgroundColor = p.lerpColor(
      p.color( ...getBg() ),
      favoriteColor,
      animation.triangleProgression()
    );

    p.background( backgroundColor );
  } else {
    p.background( ...getBg() );
  }

  if ( options.sketch?.variableZoom ) {
    const zoomValues = [
      -2000,
      -3000,
      -3000,
      -2500
    ];

    const zoom = animation.ease( {
      values: zoomValues,
      currentTime: animation.progression * zoomValues.length,
      easingFn: easing.easeInOutQuart
    } );

    p.translate(
      0,
      0,
      zoom * 0.8
    );
  } else {
    p.translate(
      0,
      0,
      options.sketch?.zoom ?? -2000
    );
  }

  if ( options.sketch?.rotateX ) {
    const xRotationValues = [
      0,
      p.PI / 6,
      -p.PI / 6,
      p.PI / 2
    ];

    p.rotateX( animation.ease( {
      values: xRotationValues,
      currentTime: animation.progression * xRotationValues.length,
      easingFn: easing.easeInOutExpo
    } ) );
  }

  if ( options.sketch?.rotateZ ) {
    p.rotateZ( animation.ease( {
      values: [
        0,
        p.PI / 2
      ],
      currentTime: +time,
      easingFn: easing.easeInOutExpo
    } ) );
  }

  p.translate(
    -p.width / 2,
    -p.height / 2
  );

  const foldingSpeed = 0;
  const columns = 1;
  const rows = 1;

  const L = animation.ease( {
    values: [
      0,
      p.width / 2
    ],
    currentTime: foldingSpeed,
    easingFn: easing.easeInOutExpo
  } );
  const R = animation.ease( {
    values: [
      p.width,
      p.width / 2
    ],
    currentTime: 0,
    easingFn: easing.easeInOutExpo
  } );

  const diamond = 0;

  const gridOptions = {
    rows,
    columns,
    diamond,
    centered: 0,
    topLeft: p.createVector(
      L,
      borderSize
    ),
    topRight: p.createVector(
      R,
      borderSize
    ),
    bottomLeft: p.createVector(
      L,
      p.height - borderSize
    ),
    bottomRight: p.createVector(
      R,
      p.height - borderSize
    )
  };

  const W = p.width / columns;
  const H = p.height / rows;

  const {
    cells
  } = await grid.create( gridOptions );

  const images = getImages();

  const imagePaths = images.map( ( {
    path
  } ) => path ).join( "-" );

  const imageParts = cache.store(
    `image-parts-${ columns }-${ rows }-${ imagePaths }`,
    () => {
      const buffer = p.createGraphics(
        p.width,
        p.height
      );

      return images.map( ( {
        img
      } ) => {
        buffer.clear();
        imageUtils.marginImage( {
          img,
          position: p.createVector(
            p.width / 2,
            p.height / 2
          ),
          graphics: buffer,
          center: true,
          // clip: true,
          fill: true
        } );

        return cells.reduce(
          (
            imageCells, {
              x, y
            }
          ) => {
            const imagePart = buffer.get(
              x,
              y,
              W,
              H
            );

            imageCells.push( {
              imagePart
            // dominantColor: colors.getDominantColor( imagePart, 500 )
            } );

            return imageCells;
          },
          []
        );
      } );
    }
  );

  // images already computed above

  // p.background( ...options.colors.background );

  cells.forEach( (
    {
      center,
      xIndex,
      yIndex,
      corners,
      absoluteCorners,
      width: cellWidth,
      height: cellHeight,
      row,
      column
    },
    cellIndex
  ) => {
    // const circonference = ( options.vertical ? cellHeight : cellWidth ) * images.length;
    const circonference = cellWidth * images.length * 1.15;

    p.push();
    p.translate(
      center.x,
      center.y
    );

    for ( let imageIndex = 0; imageIndex < images.length; imageIndex++ ) {
      const imageAtIndex = imageParts?.[ ~~imageIndex ];
      const imagePart = imageAtIndex?.[ ~~cellIndex ]?.imagePart;

      const angle = ( imageIndex / images.length ) * p.TAU;

      p.push();

      const rotateFunction = p.rotateZ.bind( p ); // options.vertical ? p.rotateX : p.rotateY;

      rotateFunction( angle );

      rotateFunction( animation.ease( {
        values: images
          .map( (
            _, index
          ) => [
            ( index / images.length ) * p.TAU
          ] )
          .flat( Infinity ),
        currentTime:
              // +column / columns
              // +imageIndex
              +row / rows +
              // +angle
              animation.progression * images.length,
        easingFn: easing.easeInOutSine
      } ) );

      p.rotateX( animation.ease( {
        values: images
          .map( (
            _, index
          ) => [
            ( index / images.length ) * p.TAU
          ] )
          .flat( Infinity ),
        currentTime:
              // +column / columns
              +imageIndex +
              angle +
              row / rows +
              animation.progression * images.length,
        easingFn: easing.easeInOutExpo
      } ) );

      p.translate(
        0,
        0,
        circonference / p.TAU
      );
      // p.translate(
      //   cellWidth * imageIndex,
      //   0
      // );

      p.noFill();
      p.texture( imagePart );

      // p.stroke( favoriteColor );
      // p.strokeWeight( 2 );
      p.rect(
        -cellWidth / 2,
        -cellHeight / 2,
        cellWidth,
        cellHeight
      );

      p.pop();
    }

    p.pop();
  } );

  renderTitle();
} );
