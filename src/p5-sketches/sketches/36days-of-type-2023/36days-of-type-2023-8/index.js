import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";
import grid from "@/p5/utils/grid.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

import addScreenPositionFunction from "@/public/assets/libraries/addScreenPositionFunction.js";

const interactive = {
  currentTimeValue: 0,
  graphics: null,
  position: null,
  image: null,
};

events.register(
  "engine-window-preload",
  () => {
    interactive.image = loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  ( {
    canvas
  } ) => {
    interactive.graphics = createGraphics(
      width,
      height
    );

    background( ...getBackgroundColor() );
    addScreenPositionFunction( window );
  },
  {
    type: "webgl",
  }
);

function getAlphaFromMask( {
  position: {
    x, y
  },
  maskPoints,
  distance = options.sketch?.mask?.distance ?? 0.015,
} ) {
  const normalizedPosition = createVector(
    map(
      x,
      -width / 2,
      width / 2,
      0,
      1
    ),
    map(
      y,
      -height / 2,
      height / 2,
      0,
      1
    )
  );

  return maskPoints.reduce(
    (
      result, pointPosition
    ) => {
      if ( true === result ) {
        return result;
      }

      const normalizedPointPosition = createVector(
        map(
          pointPosition.x,
          -width / 2,
          width / 2,
          0,
          1
        ),
        map(
          pointPosition.y,
          -height / 2,
          height / 2,
          0,
          1
        )
      );

      const d = normalizedPointPosition.dist( normalizedPosition );

      return Math.max(
        result,
        d > 0 && d < distance
      );
    },
    0
  );
}

function createGridAlphaPoints(
  gridOptions, textPointsMatrix, cacheKey
) {
  return cache.store(
    `alpha-points-matrix+${ cacheKey }`,
    () => {
      const alphaPoints = [
      ];

      grid.draw(
        gridOptions,
        ( position ) => {
          const alphaLayers = [
          ];

          for ( const points of textPointsMatrix ) {
            const alpha = getAlphaFromMask( {
              position,
              maskPoints: points,
            } );

            alphaLayers.push( alpha );
          }

          alphaPoints.push( {
            position,
            layers: alphaLayers,
          } );
        }
      );

      return alphaPoints;
    }
  );
}

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.draw( () => {
  background( ...getBackgroundColor() );

  const size = options.sketch?.shape?.size * width ?? width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;

  const columns = options.sketch?.shape?.columns ?? 65;
  const rows = ( columns * height ) / width;
  const cellSize = width / columns;

  const gridOptions = {
    topLeft: createVector(
      -width / 2,
      -height / 2
    ),
    topRight: createVector(
      width / 2,
      -height / 2
    ),
    bottomLeft: createVector(
      -width / 2,
      height / 2
    ),
    bottomRight: createVector(
      width / 2,
      height / 2
    ),
    rows,
    columns,
    centered: true,
  };

  const fonts = [
    string.fonts.martian,
    // string.fonts.multicoloure,
    // string.fonts.openSans,
    // string.fonts.sans,
    // string.fonts.serif
  ];

  const textToWrite = options.sketch?.shape?.text ?? "8";

  const textPointsMatrix = fonts.map( ( font ) =>
    string.getTextPoints( {
      text: textToWrite,
      position: createVector(
        0,
        0
      ),
      size,
      font,
      sampleFactor,
      simplifyThreshold,
    } ) );

  if ( textPointsMatrix.some( ( matrix ) => matrix.length === 0 ) ) {
    return;
  }

  const cacheComponent = [
    textToWrite,
    cellSize,
    size,
    sampleFactor,
    simplifyThreshold,
    options.sketch?.mask?.distance,
  ];
  const cacheKey = cacheComponent.join( "+" );

  const alphaPoints = createGridAlphaPoints(
    gridOptions,
    textPointsMatrix,
    cacheKey
  );

  if ( options.sketch?.animation?.rotate ?? true ) {
    const rotationMax = PI * ( options.sketch?.animation?.rotationCount ?? 2 );

    const {
      x: rX,
      y: rY,
      // z: rZ
    } = animation.ease( {
      values: [
        createVector(),
        createVector(
          0,
          rotationMax
        ),
        createVector(
          rotationMax,
          rotationMax
        ),
        createVector( rotationMax ),
      ],
      currentTime: animation.progression * 3,
      duration: 1,
      lerpFn: p5.Vector.lerp,
      easingFn: easing.easeInOutExpo,
      // easingFn: easing.easeInOutElastic,
      // easingFn: easing.easeInOutCirc,
    } );

    rotateX( rX );
    rotateY( rY );
  }

  alphaPoints.forEach( (
    {
      layers, position
    }, index
  ) => {
    const layer = mappers.circularIndex(
      animation.progression / 3,
      layers
    );
    // const layer = animation.ease({
    //   values: layers,
    //   currentTime: generalAnimationTime+1/2,
    //   duration: 1,
    //   easingFn: easing.easeInOutExpo
    // })

    if ( !layer ) {
      return;
    }

    const switchSpeed = options.sketch?.animation?.switchSpeed ?? 2;
    const switchIndexDivisor =
      options.sketch?.animation?.switchIndexDivisor ?? 5;
    const positionInfluence =
      options.sketch?.animation?.positionInfluence ?? 100;

    const hue = noise(
      position.x / columns + +map(
        sin( animation.angle ),
        -1,
        1,
        0,
        1
      ),
      position.y / rows + +map(
        cos( animation.angle ),
        -1,
        1,
        0,
        1
      )
    );

    const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 2;
    const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;

    const tint = colors.rainbow( {
      hueOffset: animation.circularProgression,
      hueIndex: map(
        hue,
        0,
        1,
        -PI,
        PI
      ) * hueMultiplier,
      opacityFactor,
    } );

    const {
      levels: [
        red,
        green,
        blue
      ],
    } = tint;

    push();

    const w = cellSize; // -2
    const h = cellSize; // -2
    const d = cellSize * ( options.sketch?.shape?.depth ?? 20 );

    translate( position );

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    if ( options.sketch.interactive.enabled && interactive.position ) {
      const screenPos = screenPosition(
        0,
        0,
        0
      );
      const distance = dist(
        interactive.position.x,
        interactive.position.y,
        screenPos.x,
        screenPos.y
      );

      interactive.currentTimeValue = map(
        distance,
        0,
        options.sketch.interactive.sensitivityMultiplier * width ?? width * 0.5,
        0,
        1
      );
    }

    const currentTimeValue = options.sketch.interactive.enabled
      ? interactive.currentTimeValue
      : animation.progression * switchSpeed +
        ( +index / alphaPoints.length / switchIndexDivisor +
          position.x / columns / positionInfluence +
          position.y / rows / positionInfluence );

    const constrainedTime = constrain(
      currentTimeValue,
      0,
      1
    );

    const fillAlpha = animation.ease( {
      values: [
        fillAlphaStart,
        fillAlphaEnd
      ],
      currentTime: constrainedTime,
      duration: 1,
      easingFn: easing.easeInOutExpo,
    } );

    fill(
      red,
      green,
      blue,
      fillAlpha
    );
    stroke(
      red,
      green,
      blue,
      strokeAlpha
    );
    box(
      w,
      h,
      -d
    );

    pop();
  } );

  if ( options.sketch.interactive.enabled ) {
    if ( options.sketch.interactive.mouse ) {
      interactive.position = createVector(
        mouseX - width / 2,
        mouseY - height / 2
      );
    } else {
      interactive.position = createVector(
        sin( animation.angle * options.sketch.interactive.sinMultiplier ) *
          ( -width / 2 ) *
          0.8,
        cos( animation.angle * options.sketch.interactive.cosMultiplier ) *
          ( -height / 2 ) *
          0.8
      );

      interactive.graphics.clear();
      interactive.graphics.image(
        interactive.image,
        interactive.position.x,
        interactive.position.y
      );
      image(
        interactive.graphics,
        0,
        0
      );
    }
  }
} );
