import {
  sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

sketch.setup(
  () => {
    background( ...options.colors.background );
    options.noSmooth && noSmooth();
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
  background( ...options.colors.background );

  const images = cache.get( "images" );

  const borderSize = 0;
  const rows = options.rows || 3;// columns*height/width;
  const columns = options.columns || 3;// rows*width/height;
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
      scale: .8,
      clip: true,
    } );
  } );

  const imageObjectAtIndex = mappers.circularIndex(
    animation.progression * images.length,
    images
  );
  const imageAtIndex = imageObjectAtIndex.img;

  imageUtils.marginImage( {
    img: imageAtIndex,
    position: createVector(
      width / 2,
      height / 2
    ),
    // graphics: canvases.background,
    center: true,
    fill: true,
    scale: .5,
    // clip: true,
  } );

  const defaultTitle = options.name.replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      0,
      height / 2,
      {
        size: 128,
        stroke: color( ...options.colors.text ),
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
} );
