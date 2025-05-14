import {
  sketch, animation, easing, mappers, imageUtils, string, events, captureOptions as options, cache, grid, colors
} from "/assets/scripts/p5-sketches/utils/index.js";

sketch.setup(
  () => {
    background( ...options.colors.background );
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

const borderSize = 0;

sketch.draw( ( time, center, favoriteColor ) => {
  background( ...options.colors.background );

  const rows = options.rows || 16;// columns*height/width;
  const columns = options.columns || 9;// rows*width/height;

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
            gridCells.reduce(
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

  const imageIndexes = imageParts.map( ( _, index ) => [
    index,
    index
  ] ).flat( Infinity );

  noFill();
  stroke( favoriteColor );

  gridCells.forEach( ( {
    position, xIndex, yIndex
  }, cellIndex ) => {
    const {
      x, y
    } = position;

    const timeIndex = animation.progression * imageIndexes.length;

    const switchIndex = (
      +noise(
        xIndex,
        yIndex,
        timeIndex
      )
      + noise(
        x / width,
        y / height,
        cellIndex
      )
    );
    const imageIndex = mappers.circularIndex(
      (
        timeIndex
        + switchIndex//* gridCells.length
      ),
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

  if ( animation.progression < 0.2 ) {
    string.write(
      options.name.replaceAll(
        "-",
        "\n"
      ),
      width / 2,
      height / 2,
      {
        size: 172,
        strokeWeight: 0,
        stroke: color( ...options.colors.background ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }

  if ( document.querySelector( "canvas#defaultCanvas0.loaded" ) === null ) {
    document.querySelector( "canvas#defaultCanvas0" ).classList.add( "loaded" );
  }
} );
