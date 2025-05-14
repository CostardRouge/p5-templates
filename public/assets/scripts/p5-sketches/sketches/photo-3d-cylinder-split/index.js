import {
  sketch, iterators, converters, debug, events, string, mappers, imageUtils, easing, animation, colors, cache, grid, captureOptions as options,
} from "/assets/scripts/p5-sketches/utils/index.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const borderSize = 0;

function getImagePart( img, x, y, w, h ) {
  // return img.get( x, y, w, h)

  return (
    img
      .get(
        x / width * img.width,
        y / height * img.height,
        img.width / ( width / w ),
        img.height / ( height / h ),
      )
  );
}

sketch.draw( ( time, center, favoriteColor ) => {
  background(
    230
  );

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

  translate(
    0,
    0,
    zoom * .8
  );

  const xRotationValues = [
    0,
    PI / 6,
    -PI / 6,
    PI / 2
  ];

  rotateX( animation.ease( {
    values: xRotationValues,
    currentTime: animation.progression * xRotationValues.length,
    easingFn: easing.easeInOutExpo
  } ) );

  // rotateZ( animation.ease( {
  //   values: [
  //     0,
  //     PI / 2
  //   ],
  //   currentTime: (
  //     +time
  //   ),
  //   easingFn: easing.easeInOutExpo
  // } ) );

  translate(
    -width / 2,
    -height / 2
  );

  const foldingSpeed = 0;
  const columns = 1;
  const rows = 1;

  const L = animation.ease( {
    values: [
      0,
      width / 2
    ],
    currentTime: foldingSpeed,
    easingFn: easing.easeInOutExpo
  } );
  const R = animation.ease( {
    values: [
      width,
      width / 2
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
    topLeft: createVector(
      L,
      borderSize
    ),
    topRight: createVector(
      R,
      borderSize
    ),
    bottomLeft: createVector(
      L,
      height - borderSize
    ),
    bottomRight: createVector(
      R,
      height - borderSize
    )
  };

  const W = width / columns;
  const H = height / rows;

  const {
    cells
  } = grid.create(
    gridOptions
  );

  const imageParts = cache.store(
    `image-parts-${ columns }-${ rows }`,
    () => {
      const buffer = createGraphics(
        sketch?.engine?.canvas?.width,
        sketch?.engine?.canvas?.height,
      );

      return (
        cache.get( "images" ).map( ( {
          img
        } ) => {
          imageUtils.marginImage( {
            img,
            position: createVector(
              width / 2,
              height / 2
            ),
            graphics: buffer,
            center: true,
            fill: true,
          } );

          return (
            cells.reduce(
              ( imageCells, {
                x, y
              } ) => {
                const imagePart = buffer.get(
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
            )
          );
        } )
      );
    }
  );

  const images = cache.get( "images" );

  cells.forEach( ( {
    center, xIndex, yIndex, corners, absoluteCorners, width: cellWidth, height: cellHeight, row, column
  }, cellIndex ) => {
    // const circularX = mappers.circular(
    //   xIndex,
    //   0, (
    //     columns - 1 ),
    //   0,
    //   1,
    //   easing.easeInOutExpo
    // );
    // const circularY = mappers.circular(
    //   yIndex,
    //   0, (
    //     rows - 1 ),
    //   0,
    //   1,
    //   easing.easeInOutQuint
    // );

    const circonference = cellWidth * images.length;

    push();
    translate(
      center.x,
      center.y
    );

    // translate(
    //   cellWidth * (
    //     animation.ease( {
    //       values: images.map( ( _, index ) => [
    //         index * -1
    //       ] ).flat( Infinity ),
    //       currentTime: (
    //         +column / columns
    //       + row / rows
    //       // +circularX/columns
    //       + time
    //       ),
    //       easingFn: easing.easeInOutQuint
    //     } )
    //   ),
    //   0
    // );

    for ( let imageIndex = 0; imageIndex < images.length; imageIndex++ ) {
      const imageAtIndex = imageParts?.[ ~~imageIndex ];
      const imagePart = imageAtIndex?.[ ~~cellIndex ]?.imagePart;

      const angle = map(
        imageIndex,
        0,
        images.length,
        0,
        TAU
      );

      push();
      rotateY( angle );

      rotateY( animation.ease( {
        values: images.map( ( _, index ) => [
          index * images.length / TAU,
          // index * images.length / TAU
        ] ).flat( Infinity ),
        currentTime: (
          // +column / columns
          +row / rows
          // + circularX / columns
          // + circularX / columns
          + animation.progression * images.length
        ),
        easingFn: easing.easeInOutExpo
      } ) );

      translate(
        0,
        0,
        ( circonference / 2 ) / PI
      );
      // translate(
      //   cellWidth * imageIndex,
      //   0
      // );

      noFill();
      texture( imagePart );

      // stroke( favoriteColor );
      // strokeWeight( 2 );
      rect(
        -cellWidth / 2,
        -cellHeight / 2,
        cellWidth,
        cellHeight
      );

      pop();
    }

    pop();
  } );

  return orbitControl();
} );
