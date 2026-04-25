import options from "@/p5/utils/options.js";
import grid from "@/p5/utils/grid.js";
import cache from "@/p5/utils/cache.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";

const getBg = () => options.sketch?.colors?.background ?? [
  0,
  0,
  0
];
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
  undefined,
  {
    type: "webgl",
    size: {
      width: options.size?.width,
      height: options.size?.height,
    },
    animation: {
      framerate:
      options.sketch?.animation?.framerate ??
      options.animation?.framerate ??
      60,
      duration:
      options.sketch?.animation?.duration ?? options.animation?.duration ?? 8,
    },
  }
);

const borderSize = 0;

sketch.draw( (
  time, center, favoriteColor
) => {
  const cylinderConfig = options.sketch?.cylinder ?? {
  };
  const animationConfig = options.sketch?.animation ?? {
  };

  if ( animationConfig.variableBackgroundColor ) {
    const backgroundColor = lerpColor(
      color( ...getBg() ),
      favoriteColor,
      animation.triangleProgression()
    );

    background( backgroundColor );
  } else {
    background( ...getBg() );
  }

  if ( cylinderConfig.variableZoom ) {
    const zoomValues = [
      -2000,
      -3000,
      -3000,
      -2500
    ];
    const zoom = animation.ease( {
      values: zoomValues,
      currentTime: animation.progression * zoomValues.length,
      easingFn: easing.easeInOutQuart,
    } );

    translate(
      0,
      0,
      zoom * 0.8
    );
  } else {
    translate(
      0,
      0,
      cylinderConfig.zoom ?? -2000
    );
  }

  if ( cylinderConfig.rotateX ) {
    const xRotationValues = [
      0,
      PI / 6,
      -PI / 6,
      PI / 2
    ];

    rotateX( animation.ease( {
      values: xRotationValues,
      currentTime: animation.progression * xRotationValues.length,
      easingFn: easing.easeInOutExpo,
    } ) );
  }

  if ( cylinderConfig.rotateZ ) {
    rotateZ( animation.ease( {
      values: [
        0,
        PI / 2
      ],
      currentTime: +time,
      easingFn: easing.easeInOutExpo,
    } ) );
  }

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
    easingFn: easing.easeInOutExpo,
  } );
  const R = animation.ease( {
    values: [
      width,
      width / 2
    ],
    currentTime: 0,
    easingFn: easing.easeInOutExpo,
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
    ),
  };

  const W = width / columns;
  const H = height / rows;

  const {
    cells
  } = grid.create( gridOptions );
  const images = getImages();
  const imagePaths = images.map( ( {
    path
  } ) => path ).join( "-" );

  const imageParts = cache.store(
    `image-parts-${ columns }-${ rows }-${ imagePaths }`,
    () => {
      const buffer = createGraphics(
        sketch?.engine?.canvas?.width,
        sketch?.engine?.canvas?.height
      );

      return images.map( ( {
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
              imagePart,
            } );
            return imageCells;
          },
          [
          ]
        );
      } );
    }
  );

  cells.forEach( (
    {
      center, width: cellWidth, height: cellHeight, row
    }, cellIndex
  ) => {
    const circonference =
        ( cylinderConfig.vertical ? cellHeight : cellWidth ) * images?.length;

    push();
    translate(
      center.x,
      center.y
    );

    for ( let imageIndex = 0; imageIndex < images?.length; imageIndex++ ) {
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

      const rotateFunction = cylinderConfig.vertical ? rotateX : rotateY;

      rotateFunction( angle );

      rotateFunction( animation.ease( {
        values: images
          .map( (
            _, index
          ) => [
            ( index / images.length ) * TAU
          ] )
          .flat( Infinity ),
        currentTime: +row / rows + animation.progression * images.length,
        easingFn: easing.easeInOutExpo,
      } ) );

      translate(
        0,
        0,
        circonference / 2 / PI
      );

      noFill();
      texture( imagePart );

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

  title.renderTitle(
    options,
    options.name
  );

  return orbitControl();
} );
